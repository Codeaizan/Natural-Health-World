// Import the React library for component creation
import React from 'react';
// Import ReactDOM to create a root and render React components to the DOM
import ReactDOM from 'react-dom/client';
// Import the main App component that contains the application logic
import App from './App';
// Import the StorageService to handle database and data operations
import { StorageService } from './services/storage';
// Import the global CSS styles for the application
import './style.css';

// Log message to indicate that application initialization has begun
// Ensure database is initialized and default admin user exists
console.log('Initializing application...');
// Define an asynchronous function to initialize the application
async function initializeApp() {
  // Begin try block to handle any initialization errors
  try {
    // Initialize storage by retrieving users (creates default admin internally for both backends)
    // getUsers() handles default admin creation internally for both backends
    await StorageService.getUsers();
    // Log success message indicating storage was initialized successfully
    console.log('Storage initialized successfully');
    
    // Get reference to the root DOM element where React will be mounted
    const rootElement = document.getElementById('root');
    // Check if the root element exists in the DOM
    if (!rootElement) {
      // If root element is not found, throw an error to prevent further execution
      throw new Error("Could not find root element to mount to");
    }

    // Create a React root instance for mounting the application
    const root = ReactDOM.createRoot(rootElement);
    // Render the App component wrapped in StrictMode for development checks
    root.render(
      // Wrap the App component in React.StrictMode to highlight potential issues
      <React.StrictMode>
        // Render the main App component
        <App />
      </React.StrictMode>
    );
  // Catch any errors that occur during initialization
  } catch (err) {
    // Log the error to the console for debugging purposes
    console.error('Initialization failed:', err);
    // Get reference to the root DOM element again
    const rootElement = document.getElementById('root');
    // Check if the root element exists
    if (rootElement) {
      // If root element exists, display error message in the DOM
      rootElement.innerHTML = '<div style="color: red; padding: 20px;">Failed to initialize database. Check console for details.</div>';
    }
  }
}

// Execute the initialization function to start the application
initializeApp();
