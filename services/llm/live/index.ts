import { geminiLiveVoiceProvider } from "./providers/geminiLiveVoiceProvider";
import { LiveVoiceProvider, LiveVoiceProviderId } from "./types";

const liveVoiceProviders: Record<LiveVoiceProviderId, LiveVoiceProvider> = {
  "gemini-live": geminiLiveVoiceProvider,
};

export function getDefaultLiveVoiceProviderId(): LiveVoiceProviderId {
  return "gemini-live";
}

export function getLiveVoiceProvider(providerId: LiveVoiceProviderId): LiveVoiceProvider {
  return liveVoiceProviders[providerId];
}
