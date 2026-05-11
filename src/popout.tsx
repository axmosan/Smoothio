import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopoutApp } from './components/PopoutApp';

const container = document.getElementById('popout-root');
if (!container) throw new Error('No popout-root element');
const root = createRoot(container);
root.render(<PopoutApp />);
