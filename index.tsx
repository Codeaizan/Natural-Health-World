import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { db } from './services/db';
import './style.css';

// Ensure database is initialized and user table is set up
console.log('Initializing database...');
async function initializeApp() {
  try {
    await db.open();
    console.log('Database opened successfully');
    
    // Ensure default admin user exists
    const users = await db.users.toArray();
    if (users.length === 0) {
      const defaultAdmin = {
        username: 'admin',
        passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        role: 'admin' as const
      };
      await db.users.add(defaultAdmin);
      console.log('Default admin user created');
    }
    
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