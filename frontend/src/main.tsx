import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { registerPwa } from './lib/pwa';
import { initNativeShell } from './lib/native';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
);

void registerPwa();
void initNativeShell();
