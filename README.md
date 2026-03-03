## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the frontend keys in `.env.local`:
   `GEMINI_API_KEY=<your_gemini_api_key>`
   `ELEVENLABS_API_KEY=<your_elevenlabs_api_key>`
3. Optional ElevenLabs TTS settings:
   `ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb`
   `ELEVENLABS_MODEL_ID=eleven_multilingual_v2`
   `ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128`
4. Run the app:
   `npm run dev`

## Classic Local Mode (Ollama + Local Speech Sidecar)

### 1) Start Ollama
1. Install Ollama and run:
   `ollama run llama3.1:8b`
2. Keep Ollama running on `http://127.0.0.1:11434`.

### 2) Start backend API
1. Install backend dependencies:
   `cd backend && npm install`
2. Start backend:
   `npm run dev`
3. Optional environment variables:
   `OLLAMA_URL` (default `http://127.0.0.1:11434`)
   `OLLAMA_MODEL` (default `llama3.1:8b`)
   `STT_SIDECAR_URL` (default `http://127.0.0.1:8001/transcribe`)

### 3) Start speech sidecar (STT + optional local TTS)
1. Install Python 3.10+ and ffmpeg.
2. Create and activate a venv in `speech-sidecar`.
3. Install sidecar dependencies:
   `pip install -r speech-sidecar/requirements.txt`
4. Start sidecar:
   `uvicorn speech-sidecar.main:app --host 127.0.0.1 --port 8001`
5. Optional environment variables:
   `STT_ENGINE` (`whisper` default, or `vosk`)
   `TTS_ENGINE` (`pyttsx3` default, or `piper`, used only by classic mode local TTS)
   `WHISPER_MODEL` (default `small`)
   `WHISPER_DEVICE` (default `cpu`)
   `WHISPER_COMPUTE_TYPE` (default `int8`)
   `VOSK_MODEL_PATH` (required when `STT_ENGINE=vosk`, path to unpacked Vosk model folder)
   `LOCAL_TTS_VOICE` (optional override for local TTS voice)
   `LOCAL_TTS_RATE` (default `180`)
   `PIPER_EXE` (default `piper`)
   `PIPER_MODEL` (required when `TTS_ENGINE=piper`)
   `PIPER_CONFIG` (optional Piper config json path)
   `PIPER_SPEAKER` (optional speaker id)
   `PIPER_LENGTH_SCALE` (optional)
   `PIPER_NOISE_SCALE` (optional)
   `PIPER_NOISE_W` (optional)

#### Vosk quick setup
1. Download a Vosk Dutch model (for example `vosk-model-nl-0.22`) and unpack it.
2. Set env vars before starting sidecar:
   `STT_ENGINE=vosk`
   `VOSK_MODEL_PATH=<pad naar modelmap>`
3. Verify sidecar engine:
   `http://127.0.0.1:8001/health` should return `sttEngine` and `ttsEngine`

### 4) Start frontend
1. In repo root:
   `npm run dev`
2. Ensure `VITE_API_BASE_URL=http://localhost:3001` for local API routing.
