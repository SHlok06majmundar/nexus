import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// After build, copy index.html to 200.html for SPA routing
try {
  const indexPath = path.resolve(__dirname, 'dist', 'index.html');
  const twoHundredPath = path.resolve(__dirname, 'dist', '200.html');
  
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, twoHundredPath);
    console.log('Created 200.html from index.html for client-side routing support.');
  }
} catch (error) {
  console.error('Error creating 200.html:', error);
}
