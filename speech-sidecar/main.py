import os
import json
import tempfile
import subprocess
import wave
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel
import pyttsx3
from sentence_transformers import SentenceTransformer
from vosk import Model as VoskModel, KaldiRecognizer


app = FastAPI(title="Eureka STT Sidecar")

STT_ENGINE = os.getenv("STT_ENGINE", "whisper").strip().lower()
TTS_ENGINE = os.getenv("TTS_ENGINE", "pyttsx3").strip().lower()
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_DEFAULT_LANGUAGE = os.getenv("WHISPER_DEFAULT_LANGUAGE", "nl")
MAX_CHARS_PER_SPEECH_SECOND = float(os.getenv("WHISPER_MAX_CHARS_PER_SPEECH_SECOND", "18"))
MIN_SPEECH_SECONDS = float(os.getenv("WHISPER_MIN_SPEECH_SECONDS", "0.45"))
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
).strip()
EMBEDDING_MODEL_PATH = os.getenv("EMBEDDING_MODEL_PATH", "").strip()
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu").strip() or "cpu"
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "24"))
EMBEDDING_NORMALIZE = os.getenv("EMBEDDING_NORMALIZE", "true").strip().lower() != "false"
EMBEDDING_QUERY_PREFIX = os.getenv("EMBEDDING_QUERY_PREFIX", "").strip()
EMBEDDING_DOCUMENT_PREFIX = os.getenv("EMBEDDING_DOCUMENT_PREFIX", "").strip()
VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "").strip()
VOSK_SAMPLE_RATE = float(os.getenv("VOSK_SAMPLE_RATE", "16000"))
LOCAL_TTS_RATE = int(os.getenv("LOCAL_TTS_RATE", "180"))
LOCAL_TTS_VOICE = os.getenv("LOCAL_TTS_VOICE", "").strip().lower()
PIPER_EXE = os.getenv("PIPER_EXE", "piper").strip() or "piper"
PIPER_MODEL = os.getenv("PIPER_MODEL", "").strip()
PIPER_CONFIG = os.getenv("PIPER_CONFIG", "").strip()
PIPER_SPEAKER = os.getenv("PIPER_SPEAKER", "").strip()
PIPER_LENGTH_SCALE = os.getenv("PIPER_LENGTH_SCALE", "").strip()
PIPER_NOISE_SCALE = os.getenv("PIPER_NOISE_SCALE", "").strip()
PIPER_NOISE_W = os.getenv("PIPER_NOISE_W", "").strip()

model = WhisperModel(
    WHISPER_MODEL,
    device=WHISPER_DEVICE,
    compute_type=WHISPER_COMPUTE_TYPE,
)
vosk_model: Optional[VoskModel] = None
embedding_model: Optional[SentenceTransformer] = None


def synthesize_local_tts(text: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_temp:
        wav_path = wav_temp.name

    engine = pyttsx3.init()
    try:
        engine.setProperty("rate", LOCAL_TTS_RATE)
        voices = engine.getProperty("voices")
        selected_voice_id: Optional[str] = None

        if LOCAL_TTS_VOICE:
            for voice in voices:
                voice_id = str(getattr(voice, "id", "")).lower()
                voice_name = str(getattr(voice, "name", "")).lower()
                if LOCAL_TTS_VOICE in voice_id or LOCAL_TTS_VOICE in voice_name:
                    selected_voice_id = str(voice.id)
                    break

        # Prefer a Dutch voice by default when no explicit override is configured.
        if selected_voice_id is None:
            for voice in voices:
                voice_id = str(getattr(voice, "id", "")).lower()
                voice_name = str(getattr(voice, "name", "")).lower()
                voice_languages = getattr(voice, "languages", []) or []
                normalized_languages = " ".join(str(lang).lower() for lang in voice_languages)
                if (
                    "nl" in normalized_languages
                    or "dutch" in voice_name
                    or "dutch" in voice_id
                    or "nederlands" in voice_name
                    or "nederlands" in voice_id
                ):
                    selected_voice_id = str(voice.id)
                    break

        if selected_voice_id is not None:
            engine.setProperty("voice", selected_voice_id)
        engine.save_to_file(text, wav_path)
        engine.runAndWait()
        return wav_path
    except Exception:
        try:
            os.remove(wav_path)
        except OSError:
            pass
        raise
    finally:
        engine.stop()


def run_pyttsx3_tts(text: str, language: str) -> str:
    return synthesize_local_tts(text)


def run_piper_tts(text: str, language: str) -> str:
    if not PIPER_MODEL:
        raise RuntimeError("PIPER_MODEL is niet ingesteld.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_temp:
        wav_path = wav_temp.name

    cmd = [
        PIPER_EXE,
        "--model",
        PIPER_MODEL,
        "--output_file",
        wav_path,
    ]

    if PIPER_CONFIG:
        cmd.extend(["--config", PIPER_CONFIG])
    if PIPER_SPEAKER:
        cmd.extend(["--speaker", PIPER_SPEAKER])
    if PIPER_LENGTH_SCALE:
        cmd.extend(["--length_scale", PIPER_LENGTH_SCALE])
    if PIPER_NOISE_SCALE:
        cmd.extend(["--noise_scale", PIPER_NOISE_SCALE])
    if PIPER_NOISE_W:
        cmd.extend(["--noise_w", PIPER_NOISE_W])

    try:
        subprocess.run(
            cmd,
            input=text.encode("utf-8"),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=True,
        )
        return wav_path
    except FileNotFoundError as err:
        try:
            os.remove(wav_path)
        except OSError:
            pass
        raise RuntimeError(f"Piper executable niet gevonden: {PIPER_EXE}") from err
    except subprocess.CalledProcessError as err:
        try:
            os.remove(wav_path)
        except OSError:
            pass
        details = err.stderr.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(f"Piper TTS mislukt: {details or 'onbekende fout'}") from err


def run_tts(text: str, language: str) -> str:
    if TTS_ENGINE == "pyttsx3":
        return run_pyttsx3_tts(text, language)
    if TTS_ENGINE == "piper":
        return run_piper_tts(text, language)
    raise RuntimeError(f"Onbekende TTS engine: {TTS_ENGINE}")


def get_vosk_model() -> VoskModel:
    global vosk_model
    if vosk_model is not None:
        return vosk_model

    if not VOSK_MODEL_PATH:
        raise RuntimeError("VOSK_MODEL_PATH is niet ingesteld.")
    if not Path(VOSK_MODEL_PATH).exists():
        raise RuntimeError(f"Vosk model pad bestaat niet: {VOSK_MODEL_PATH}")

    vosk_model = VoskModel(VOSK_MODEL_PATH)
    return vosk_model


def get_embedding_model() -> SentenceTransformer:
    global embedding_model
    if embedding_model is not None:
        return embedding_model

    model_id = EMBEDDING_MODEL_PATH or EMBEDDING_MODEL
    embedding_model = SentenceTransformer(model_id, device=EMBEDDING_DEVICE)
    return embedding_model


def prepare_embedding_text(text: str, input_type: str) -> str:
    clean = text.strip()
    if not clean:
        return clean
    if input_type == "query" and EMBEDDING_QUERY_PREFIX:
        return f"{EMBEDDING_QUERY_PREFIX}{clean}"
    if input_type == "document" and EMBEDDING_DOCUMENT_PREFIX:
        return f"{EMBEDDING_DOCUMENT_PREFIX}{clean}"
    return clean


def run_embeddings(texts: list[str], input_type: str) -> list[list[float]]:
    model_ref = get_embedding_model()
    prepared_texts = [prepare_embedding_text(text, input_type) for text in texts]
    embeddings = model_ref.encode(
        prepared_texts,
        batch_size=EMBEDDING_BATCH_SIZE,
        normalize_embeddings=EMBEDDING_NORMALIZE,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return embeddings.tolist()


def run_whisper_transcribe(temp_path: str, language: str) -> str:
    target_language: Optional[str] = (language or WHISPER_DEFAULT_LANGUAGE).strip() or "nl"

    def run_pass(pass_language: Optional[str], vad_filter: bool) -> str:
        segments, _ = model.transcribe(
            temp_path,
            language=pass_language,
            vad_filter=vad_filter,
            beam_size=1,
            best_of=1,
            condition_on_previous_text=False,
            temperature=0.0,
            no_speech_threshold=0.5,
            log_prob_threshold=-1.0,
            compression_ratio_threshold=2.0,
            initial_prompt="Dit is Nederlands gesproken lesmateriaal.",
            vad_parameters={
                "min_silence_duration_ms": 700,
                "speech_pad_ms": 120,
            },
        )

        filtered_texts: list[str] = []
        total_speech_seconds = 0.0
        total_no_speech_prob = 0.0
        kept_segments = 0

        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            if segment.no_speech_prob is not None and segment.no_speech_prob > 0.55:
                continue
            if segment.avg_logprob is not None and segment.avg_logprob < -1.0:
                continue
            filtered_texts.append(text)
            total_speech_seconds += max(0.0, float(segment.end) - float(segment.start))
            total_no_speech_prob += float(segment.no_speech_prob or 0.0)
            kept_segments += 1

        text_out = " ".join(filtered_texts).strip()
        if not text_out:
            return ""
        if total_speech_seconds < MIN_SPEECH_SECONDS:
            return ""

        chars_per_second = len(text_out) / max(total_speech_seconds, 0.001)
        avg_no_speech = total_no_speech_prob / max(kept_segments, 1)

        # Reject likely hallucinations from short/noisy clips.
        if chars_per_second > MAX_CHARS_PER_SPEECH_SECOND:
            return ""
        if avg_no_speech > 0.45:
            return ""
        return text_out

    text = run_pass(target_language, vad_filter=True)
    if not text:
        text = run_pass(target_language, vad_filter=False)
    return text


def run_vosk_transcribe(temp_path: str) -> str:
    model_ref = get_vosk_model()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_temp:
        wav_path = wav_temp.name

    try:
        ffmpeg_cmd = [
            "ffmpeg",
            "-y",
            "-i",
            temp_path,
            "-ac",
            "1",
            "-ar",
            str(int(VOSK_SAMPLE_RATE)),
            "-f",
            "wav",
            wav_path,
        ]
        subprocess.run(
            ffmpeg_cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )

        with wave.open(wav_path, "rb") as wf:
            rec = KaldiRecognizer(model_ref, float(wf.getframerate()))
            rec.SetWords(False)
            chunks: list[str] = []

            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    part = json.loads(rec.Result()).get("text", "").strip()
                    if part:
                        chunks.append(part)

            final_part = json.loads(rec.FinalResult()).get("text", "").strip()
            if final_part:
                chunks.append(final_part)

            return " ".join(chunks).strip()
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "ok": True,
        "sttEngine": STT_ENGINE,
        "ttsEngine": TTS_ENGINE,
        "embeddingModel": EMBEDDING_MODEL_PATH or EMBEDDING_MODEL,
    }


@app.post("/synthesize")
async def synthesize(payload: dict[str, str]) -> dict[str, str]:
    text = (payload.get("text") or "").strip()
    language = (payload.get("language") or "nl").strip() or "nl"
    if not text:
        raise HTTPException(status_code=400, detail="Lege tekst.")

    wav_path = run_tts(text, language)
    try:
        with open(wav_path, "rb") as audio_file:
            import base64

            encoded = base64.b64encode(audio_file.read()).decode("ascii")
        return {"audioBase64": encoded, "mimeType": "audio/wav"}
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("nl"),
) -> dict[str, str]:
    suffix = Path(audio.filename or "speech.webm").suffix or ".webm"
    data = await audio.read()

    if not data:
        raise HTTPException(status_code=400, detail="Lege audio-upload.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(data)
        temp_path = temp.name

    try:
        if STT_ENGINE == "vosk":
            text = run_vosk_transcribe(temp_path)
        else:
            text = run_whisper_transcribe(temp_path, language)
        return {"text": text}
    except subprocess.CalledProcessError:
        raise HTTPException(
            status_code=500,
            detail="ffmpeg conversie mislukt. Controleer of ffmpeg is geinstalleerd.",
        )
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


@app.post("/embed")
async def embed(payload: dict[str, object]) -> dict[str, object]:
    raw_texts = payload.get("texts")
    input_type = str(payload.get("inputType") or "document").strip().lower()

    if not isinstance(raw_texts, list):
        raise HTTPException(status_code=400, detail="texts moet een array zijn.")

    texts = [str(item or "").strip() for item in raw_texts]
    texts = [text for text in texts if text]
    if not texts:
        raise HTTPException(status_code=400, detail="texts mag niet leeg zijn.")

    if input_type not in {"query", "document"}:
        raise HTTPException(status_code=400, detail="inputType moet query of document zijn.")

    try:
        embeddings = run_embeddings(texts, input_type)
        return {
            "embeddings": embeddings,
            "model": EMBEDDING_MODEL_PATH or EMBEDDING_MODEL,
        }
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
