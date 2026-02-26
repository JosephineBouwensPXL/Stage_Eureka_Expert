import os
import json
import tempfile
import subprocess
import wave
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel
from vosk import Model as VoskModel, KaldiRecognizer


app = FastAPI(title="Eureka STT Sidecar")

STT_ENGINE = os.getenv("STT_ENGINE", "whisper").strip().lower()
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_DEFAULT_LANGUAGE = os.getenv("WHISPER_DEFAULT_LANGUAGE", "nl")
MAX_CHARS_PER_SPEECH_SECOND = float(os.getenv("WHISPER_MAX_CHARS_PER_SPEECH_SECOND", "18"))
MIN_SPEECH_SECONDS = float(os.getenv("WHISPER_MIN_SPEECH_SECONDS", "0.45"))
VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "").strip()
VOSK_SAMPLE_RATE = float(os.getenv("VOSK_SAMPLE_RATE", "16000"))

model = WhisperModel(
    WHISPER_MODEL,
    device=WHISPER_DEVICE,
    compute_type=WHISPER_COMPUTE_TYPE,
)
vosk_model: Optional[VoskModel] = None


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
    return {"ok": True, "engine": STT_ENGINE}


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
