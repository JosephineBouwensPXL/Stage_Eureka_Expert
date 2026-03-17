import { LiveVoiceProvider } from '../types';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

function resolveNativeVoiceRelayUrl(): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/native-voice';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export const geminiLiveVoiceProvider: LiveVoiceProvider = {
  id: 'gemini-live',
  label: 'Gemini Live',
  async connect(options, callbacks) {
    const relayUrl = resolveNativeVoiceRelayUrl();
    const ws = new WebSocket(relayUrl);
    let onOpenResolved = false;

    const send = (payload: unknown) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(payload));
    };

    const waitForOpen = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Native voice relay timeout.'));
      }, 12000);

      ws.onopen = () => {
        send({
          type: 'start',
          systemInstruction: options.systemInstruction,
          ttsEnabled: options.ttsEnabled,
          fileSearchStoreName: options.fileSearchStoreName,
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as
            | { type: 'open' }
            | { type: 'input_transcription'; text: string }
            | { type: 'output_transcription'; text: string }
            | { type: 'turn_complete' }
            | { type: 'audio_chunk'; data: string }
            | { type: 'interrupted' }
            | { type: 'error'; message: string }
            | { type: 'closed' };

          if (message.type === 'open') {
            if (!onOpenResolved) {
              onOpenResolved = true;
              window.clearTimeout(timeout);
              callbacks.onOpen();
              resolve();
            }
            return;
          }

          if (message.type === 'input_transcription') {
            callbacks.onInputTranscription(message.text);
            return;
          }

          if (message.type === 'output_transcription') {
            callbacks.onOutputTranscription(message.text);
            return;
          }

          if (message.type === 'turn_complete') {
            callbacks.onTurnComplete();
            return;
          }

          if (message.type === 'audio_chunk') {
            callbacks.onAudioChunk(message.data);
            return;
          }

          if (message.type === 'interrupted') {
            callbacks.onInterrupted();
            return;
          }

          if (message.type === 'error') {
            const error = new Error(message.message);
            callbacks.onError(error);
            if (!onOpenResolved) {
              onOpenResolved = true;
              window.clearTimeout(timeout);
              reject(error);
            }
            return;
          }

          if (message.type === 'closed') {
            callbacks.onClose();
          }
        } catch (error) {
          callbacks.onError(error);
        }
      };

      ws.onerror = () => {
        const error = new Error('Native voice relay websocket error.');
        callbacks.onError(error);
        if (!onOpenResolved) {
          onOpenResolved = true;
          window.clearTimeout(timeout);
          reject(error);
        }
      };

      ws.onclose = () => {
        callbacks.onClose();
      };
    });

    await waitForOpen;

    return {
      sendAudioChunk(data, mimeType) {
        send({
          type: 'audio',
          data: encodeBase64(data),
          mimeType,
        });
      },
      close() {
        send({ type: 'close' });
        ws.close();
      },
    };
  },
};
