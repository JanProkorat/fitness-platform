import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

// React Native has no window focus: report the app returning to the foreground instead.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

export const queryClient = new QueryClient();
