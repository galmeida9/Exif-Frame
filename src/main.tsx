import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { hydrateStore } from './store';
import { loadFonts } from './fonts';

async function bootstrap() {
  await loadFonts();
  await hydrateStore();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
