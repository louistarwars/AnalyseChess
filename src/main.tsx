import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/fonts-manga.css';
import './styles/global.css';
import './styles/manga.css';

createRoot(document.getElementById('root')!).render(<App />);
