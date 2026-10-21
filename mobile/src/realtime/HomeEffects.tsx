import { usePushRegistration, usePushTapNavigation } from '@/hooks/usePushRegistration';

import { RealtimeSync } from './RealtimeSync';

/** Everything that runs only while the signed-in client is on the home screens. Renders nothing. */
export function HomeEffects() {
  usePushRegistration();
  usePushTapNavigation();
  return <RealtimeSync />;
}
