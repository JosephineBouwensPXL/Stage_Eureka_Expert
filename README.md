## Architecture

The project uses a modular AI architecture with separate provider layers for:

- `LLM` text generation
- `STT` speech-to-text
- `TTS` text-to-speech
- live voice sessions

Current implementation:

- `LLM` providers:
  `gemini` for cloud text generation
  `local-ollama` for local classic mode text generation via the backend
- `STT` providers:
  `browser`
  `local-sidecar`
- `TTS` providers:
  `browser`
  `local-sidecar`
  `elevenlabs`
- live voice providers:
  `gemini-live`

Routing in the current system:

- In `classic` mode, the frontend uses the backend as integration layer for `/local/chat`, `/local/stt`, `/local/classic-tts` and `/local/tts`.
- The backend then communicates with external or sidecar services such as Ollama, ElevenLabs and the Python speech sidecar.
- In `native` voice mode, the frontend currently connects directly to Gemini Live for real-time audio and transcription.

Study materials:

- Documents are currently uploaded and parsed locally in the frontend.
- In text chat and `classic` voice mode, selected study materials are now chunked locally, embedded via a local sidecar model, and retrieved in RAM per user query before the relevant chunks are sent to the LLM.
- In `native` voice mode, the current live session still uses a static combined context because the provider session is opened once with a fixed instruction set.
- There is currently no dedicated API integration that retrieves learning content directly from Eureka handbooks or another external content platform.

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
   `TTS_SIDECAR_URL` (default `http://127.0.0.1:8001/synthesize`)
   `EMBED_SIDECAR_URL` (default `http://127.0.0.1:8001/embed`)
   `OTEL_SERVICE_NAME` (default `eureka-studybuddy-backend`)
   `OTEL_SAMPLING_RATIO` (default `0.5`)
   `OTEL_DEBUG=true` (optioneel, extra OpenTelemetry logs)

### 2b) Google Cloud Trace via OpenTelemetry
1. Geef de backend Application Default Credentials:
   `gcloud auth application-default login`
   of zet `GOOGLE_APPLICATION_CREDENTIALS=<pad-naar-service-account-json>`
2. Zet optioneel je project expliciet:
   `GOOGLE_CLOUD_PROJECT=<jouw-gcp-project-id>`
3. Start de backend opnieuw vanuit `backend/`:
   `npm run dev`
4. Maak requests naar `/local/chat`, `/local/tts`, `/local/classic-tts` of `/local/stt`.
5. Open Google Cloud:
   `Observability -> Trace -> Trace Explorer`
6. Binnen ongeveer 30-60 seconden zie je traces voor Express requests plus aparte spans voor:
   `ai.ollama.chat`
   `ai.elevenlabs.tts`
   `ai.local_tts.synthesize`
   `ai.local_stt.transcribe`

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
   `EMBEDDING_MODEL` (default `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`)
   `EMBEDDING_MODEL_PATH` (optioneel, lokaal modelpad; gebruik dit voor echt 100% offline embeddings)
   `EMBEDDING_DEVICE` (default `cpu`)
   `EMBEDDING_BATCH_SIZE` (default `24`)
   `EMBEDDING_QUERY_PREFIX` (optioneel, handig voor E5-modellen, bijv. `query: `)
   `EMBEDDING_DOCUMENT_PREFIX` (optioneel, handig voor E5-modellen, bijv. `passage: `)
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

### Local RAG flow

De lokale RAG-flow werkt nu als volgt:

1. Upload `.txt`, `.docx`, `.pdf` of `.pptx` in de bibliotheek.
2. De frontend splitst de geselecteerde documenten in chunks.
3. De chunks worden lokaal ge-embed via de Python sidecar.
4. De embeddingvectoren blijven in RAM in de frontend.
5. Per chatvraag of classic voice-turn wordt een query-embedding gemaakt.
6. De frontend doet similarity search in RAM en stuurt alleen de meest relevante chunks door naar Gemini of Ollama.

Voor een volledig offline setup:

1. Zet `EMBEDDING_MODEL_PATH` naar een lokale map met een embeddingmodel.
2. Start Ollama lokaal.
3. Start de backend lokaal.
4. Start de speech/embedding sidecar lokaal.

Dan blijven documenten, embeddings, retrieval en de LLM-flow volledig lokaal, behalve wanneer je bewust `native` mode met Gemini gebruikt.

### 4) Start frontend
1. In repo root:
   `npm run dev`
2. Ensure `VITE_API_BASE_URL=http://localhost:3001` for local API routing.

## Accurate Project Description

The following formulation matches the current implementation more closely:

`Verder wordt een architectuur uitgewerkt waarbij de chatbot via afzonderlijke providerlagen communiceert met taalmodellen, spraakherkenning en tekst-naar-spraakfunctionaliteiten. In de classic flow verloopt de communicatie met lokale en externe spraakdiensten via een backendlaag, terwijl in de native voice-flow rechtstreeks met Gemini Live wordt gecommuniceerd. Leerinhouden uit geselecteerde Eureka-documenten worden momenteel lokaal verwerkt en als context meegestuurd om gepersonaliseerde antwoorden te genereren.`
