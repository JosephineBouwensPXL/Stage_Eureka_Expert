## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Classic Local Mode (Ollama + faster-whisper)

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

### 3) Start faster-whisper sidecar
1. Install Python 3.10+ and ffmpeg.
2. Create and activate a venv in `speech-sidecar`.
3. Install sidecar dependencies:
   `pip install -r speech-sidecar/requirements.txt`
4. Start sidecar:
   `uvicorn speech-sidecar.main:app --host 127.0.0.1 --port 8001`
5. Optional environment variables:
   `WHISPER_MODEL` (default `small`)
   `WHISPER_DEVICE` (default `cpu`)
   `WHISPER_COMPUTE_TYPE` (default `int8`)

### 4) Start frontend
1. In repo root:
   `npm run dev`
2. Ensure `VITE_API_BASE_URL=http://localhost:3001` for local API routing.
