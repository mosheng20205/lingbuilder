import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ModuleInfoWindow from './components/ModuleInfoWindow';
import './index.css';
import '@xterm/xterm/css/xterm.css';

const moduleInfoWindow = new URLSearchParams(window.location.search).has('module-info-window');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {moduleInfoWindow ? <ModuleInfoWindow /> : <App />}
  </StrictMode>,
);
