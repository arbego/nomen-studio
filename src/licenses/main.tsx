import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { LicenseLoader } from './LicenseLoader';

createRoot(document.getElementById('root')!).render(<StrictMode><LicenseLoader /></StrictMode>);
