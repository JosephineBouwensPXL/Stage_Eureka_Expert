import { ClassicTtsMode, ModeAccess, NativeTtsMode } from '../../../types';
import { browserTtsProvider } from './providers/browserTtsProvider';
import { elevenLabsTtsProvider } from './providers/elevenLabsTtsProvider';
import { localSidecarTtsProvider } from './providers/localSidecarTtsProvider';
import { TtsProvider, TtsProviderId } from './types';

const ttsProviders: Record<TtsProviderId, TtsProvider> = {
  browser: browserTtsProvider,
  'local-sidecar': localSidecarTtsProvider,
  elevenlabs: elevenLabsTtsProvider,
};

export function getTtsProvider(providerId: TtsProviderId): TtsProvider {
  return ttsProviders[providerId];
}

export function getClassicTtsProviderId(mode: ClassicTtsMode): TtsProviderId {
  return mode === 'browser' ? 'browser' : 'local-sidecar';
}

export function getChatTtsProviderId(
  engineMode: ModeAccess,
  classicTtsMode: ClassicTtsMode,
  nativeTtsMode: NativeTtsMode
): TtsProviderId {
  if (engineMode === ModeAccess.CLASSIC) return getClassicTtsProviderId(classicTtsMode);
  return nativeTtsMode === 'browser' ? 'browser' : 'elevenlabs';
}
