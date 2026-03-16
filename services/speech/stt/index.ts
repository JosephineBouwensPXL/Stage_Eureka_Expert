import { ClassicSttMode } from '../../../types';
import { browserSttProvider } from './providers/browserSttProvider';
import { localSidecarSttProvider } from './providers/localSidecarSttProvider';
import { SttProvider, SttProviderId } from './types';

const sttProviders: Record<SttProviderId, SttProvider> = {
  browser: browserSttProvider,
  'local-sidecar': localSidecarSttProvider,
};

export function getSttProvider(providerId: SttProviderId): SttProvider {
  return sttProviders[providerId];
}

export function getClassicSttProviderId(mode: ClassicSttMode): SttProviderId {
  return mode === 'browser' ? 'browser' : 'local-sidecar';
}
