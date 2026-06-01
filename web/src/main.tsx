// Must be the first import so the polyfill is in place before any module that
// calls crypto.randomUUID() (toast store, nutrition/training plan stores, etc.).
// In secure contexts (HTTPS / localhost) the native implementation is untouched.
import '@/lib/polyfills';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/dialog-animations.css';
import './i18n';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
