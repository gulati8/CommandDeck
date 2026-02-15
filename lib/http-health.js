'use strict';

const http = require('http');

/**
 * Create an HTTP server that serves a /health endpoint.
 * Returns { status: "ok", uptime: process.uptime() } on GET /health,
 * 404 for all other routes.
 *
 * @param {number} port - The port to listen on
 * @returns {http.Server} The HTTP server instance
 */
function createHealthServer(port) {
  const server = http.createServer((req, res) => {
    // Handle GET /health
    if (req.method === 'GET' && req.url === '/health') {
      const healthData = {
        status: 'ok',
        uptime: process.uptime()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthData));
      return;
    }

    // All other routes return 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  // Error handling to prevent crashes
  server.on('error', (err) => {
    console.error('HTTP health server error:', err.message);
  });

  server.listen(port, () => {
    console.log(`HTTP health endpoint listening on port ${port}`);
  });

  return server;
}

module.exports = { createHealthServer };
