import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// NOTE: StrictMode intentionally removed — it double-mounts in dev, which
// triggers two simultaneous Gemini Live connections.  The first gets torn down
// after a few seconds, killing the active microphone stream and making it
// appear that the mic "turns off by itself".
createRoot(document.getElementById('root')!).render(<App />);
