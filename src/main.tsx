import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/big-shoulders-display/latin-700';
import '@fontsource/big-shoulders-display/latin-800';
import '@fontsource/public-sans/latin-400';
import '@fontsource/public-sans/latin-600';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './app/App';
import { registerServiceWorker } from './lib/sw-register';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
