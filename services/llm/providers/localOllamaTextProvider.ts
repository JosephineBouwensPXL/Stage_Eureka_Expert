import { sendMessageStreamToLocalLLM } from "../../localSpeechService";
import { LlmTextProvider, StreamChatRequest } from "../types";

async function* streamChat({ message, chatHistory, studyMaterial }: StreamChatRequest) {
  yield* sendMessageStreamToLocalLLM(message, chatHistory, studyMaterial);
}

export const localOllamaTextProvider: LlmTextProvider = {
  id: "local-ollama",
  label: "Local Ollama",
  streamChat,
};
