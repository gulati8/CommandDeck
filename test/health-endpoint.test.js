'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { createHealthServer } = require('../lib/http-health');

// Helper function to make HTTP requests
function makeRequest(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: method
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

describe('health endpoint', () => {
  let server;
  let port;

  before(async () => {
    // Start server on ephemeral port (0)
    server = createHealthServer(0);

    // Wait for server to be listening and capture the actual port
    await new Promise((resolve) => {
      server.on('listening', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  describe('GET /health', () => {
    it('should return 200 status', async () => {
      const response = await makeRequest(port, '/health', 'GET');
      assert.equal(response.statusCode, 200);
    });

    it('should return correct JSON structure with status and uptime fields', async () => {
      const response = await makeRequest(port, '/health', 'GET');
      const json = JSON.parse(response.body);

      // Verify structure has both required fields
      assert.ok('status' in json, 'Response should have status field');
      assert.ok('uptime' in json, 'Response should have uptime field');

      // Verify no extra fields
      const keys = Object.keys(json);
      assert.equal(keys.length, 2, 'Response should have exactly 2 fields');
    });

    it('should have status field set to "ok"', async () => {
      const response = await makeRequest(port, '/health', 'GET');
      const json = JSON.parse(response.body);
      assert.equal(json.status, 'ok');
    });

    it('should have uptime as a number greater than 0', async () => {
      const response = await makeRequest(port, '/health', 'GET');
      const json = JSON.parse(response.body);

      // Verify uptime is a number
      assert.equal(typeof json.uptime, 'number', 'uptime should be a number');

      // Verify uptime is greater than 0
      assert.ok(json.uptime > 0, 'uptime should be greater than 0');
    });

    it('should return application/json content-type header', async () => {
      const response = await makeRequest(port, '/health', 'GET');
      const contentType = response.headers['content-type'];
      assert.equal(contentType, 'application/json');
    });

    it('should return valid JSON body', async () => {
      const response = await makeRequest(port, '/health', 'GET');

      // Should not throw
      assert.doesNotThrow(() => {
        JSON.parse(response.body);
      }, 'Response body should be valid JSON');
    });

    it('should report increasing uptime on subsequent requests', async () => {
      const response1 = await makeRequest(port, '/health', 'GET');
      const json1 = JSON.parse(response1.body);
      const uptime1 = json1.uptime;

      // Wait a bit then make another request
      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await makeRequest(port, '/health', 'GET');
      const json2 = JSON.parse(response2.body);
      const uptime2 = json2.uptime;

      // Second uptime should be greater than first
      assert.ok(uptime2 > uptime1, 'uptime should increase over time');
    });
  });

  describe('other routes', () => {
    it('should return 404 for GET /', async () => {
      const response = await makeRequest(port, '/', 'GET');
      assert.equal(response.statusCode, 404);
    });

    it('should return 404 for GET /other', async () => {
      const response = await makeRequest(port, '/other', 'GET');
      assert.equal(response.statusCode, 404);
    });

    it('should return 404 with JSON error body for non-health routes', async () => {
      const response = await makeRequest(port, '/notfound', 'GET');

      assert.equal(response.statusCode, 404);
      const json = JSON.parse(response.body);
      assert.ok('error' in json);
      assert.equal(json.error, 'not found');
    });

    it('should return 404 for POST /health', async () => {
      const response = await makeRequest(port, '/health', 'POST');
      assert.equal(response.statusCode, 404);
    });

    it('should return 404 for PUT /health', async () => {
      const response = await makeRequest(port, '/health', 'PUT');
      assert.equal(response.statusCode, 404);
    });

    it('should return 404 for DELETE /health', async () => {
      const response = await makeRequest(port, '/health', 'DELETE');
      assert.equal(response.statusCode, 404);
    });
  });

  describe('server instance', () => {
    it('should be able to start server on ephemeral port', async () => {
      const testServer = createHealthServer(0);

      await new Promise((resolve) => {
        testServer.on('listening', () => {
          const ephemeralPort = testServer.address().port;
          assert.ok(ephemeralPort > 0, 'Should bind to a port');
          testServer.close(() => resolve());
        });
      });
    });

    it('should handle graceful shutdown', async () => {
      const testServer = createHealthServer(0);

      await new Promise((resolve) => {
        testServer.on('listening', () => {
          testServer.close(() => {
            // Server closed successfully
            resolve();
          });
        });
      });
    });
  });
});
