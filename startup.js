// Azure App Service startup script
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Node.js application...');

// Set environment variables for Azure
process.env.PORT = process.env.PORT || process.env.WEBSITES_PORT || 3000;

// Start the main application
const serverPath = path.join(__dirname, 'src', 'server.js');
const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: process.env
});

server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.kill('SIGTERM');
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    server.kill('SIGINT');
});