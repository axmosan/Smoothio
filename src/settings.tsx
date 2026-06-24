import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsApp } from './components/SettingsApp';

const container = document.getElementById('settings-root');
if (!container) throw new Error('No settings-root element');
const root = createRoot(container);
root.render(<SettingsApp />);
