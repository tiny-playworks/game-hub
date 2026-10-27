import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PageErrorBoundary } from './components/recovery/PageErrorBoundary';
import { applyTheme, getStoredTheme } from './lib/theme';

applyTheme(getStoredTheme());

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <PageErrorBoundary>
        <App />
      </PageErrorBoundary>
    </React.StrictMode>,
  );
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Both workers use the root scope. Keep the explicitly installed offline
    // worker when it is active or being installed instead of replacing it on
    // every page load with the legacy navigation-only worker.
    void navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => {
        const workers = [
          registration?.active,
          registration?.waiting,
          registration?.installing,
        ];
        if (
          workers.some(
            (worker) =>
              worker &&
              new URL(worker.scriptURL).pathname === '/offline-worker.js',
          )
        )
          return;
        return navigator.serviceWorker.register('/sw.js');
      })
      .catch(() => {});
  });
}
