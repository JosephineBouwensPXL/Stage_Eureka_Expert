import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel


app = FastAPI(title="Eureka STT Sidecar")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

model = WhisperModel(
    WHISPER_MODEL,
    device=WHISPER_DEVICE,
    compute_type=WHISPER_COMPUTE_TYPE,
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


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
        segments, _ = model.transcribe(
            temp_path,
            language=language,
            vad_filter=True,
            beam_size=1,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"text": text}
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
