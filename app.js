/**
 * app.js - Entry Point for the 111Movies Personal Streaming Client (605streams)
 */

import { initUI } from './ui.js';

// Bootstrap the application once the DOM is fully loaded and ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing 605streams personal client...');
  try {
    initUI();
    console.log('605streams client initialized successfully.');
  } catch (error) {
    console.error('Critical initialization error:', error);
  }
});
