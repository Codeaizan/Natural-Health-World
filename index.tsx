import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './services/storage';
import './style.css';

// Ensure database is initialized and default admin user exists
console.log('Initializing application...');
async function initializeApp() {
  try {
    // getUsers() handles default admin creation internally for both backends
    await StorageService.getUsers();
    console.log('Storage initialized successfully');
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error("Could not find root element to mount to");
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error('Initialization failed:', err);
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = '<div style="color: red; padding: 20px;">Failed to initialize database. Check console for details.</div>';
    }
  }
}

initializeApp();
