'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { createHTTPServer } = require('../server');

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
    server = createHTTPServer(null);
    await new Promise((resolve) => {
      server.listen(0, () => {
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

  describe('GET /api/health', () => {
    it('should return 200 status', async () => {
      const response = await makeRequest(port, '/api/health', 'GET');
      assert.equal(response.statusCode, 200);
    });

    it('should return correct JSON structure with status and uptime fields', async () => {
      const response = await makeRequest(port, '/api/health', 'GET');
      const json = JSON.parse(response.body);

      assert.ok('status' in json, 'Response should have status field');
      assert.ok('uptime' in json, 'Response should have uptime field');
    });

    it('should have status field set to "ok"', async () => {
      const response = await makeRequest(port, '/api/health', 'GET');
      const json = JSON.parse(response.body);
      assert.equal(json.status, 'ok');
    });

    it('should have uptime as a number greater than 0', async () => {
      const response = await makeRequest(port, '/api/health', 'GET');
      const json = JSON.parse(response.body);

      assert.equal(typeof json.uptime, 'number', 'uptime should be a number');
      assert.ok(json.uptime > 0, 'uptime should be greater than 0');
    });

    it('should return application/json content-type header', async () => {
      const response = await makeRequest(port, '/api/health', 'GET');
      const contentType = response.headers['content-type'];
      assert.equal(contentType, 'application/json');
    });

    it('should return valid JSON body', async () => {
      const response = await makeRequest(port, '/api/health', 'GET');

      assert.doesNotThrow(() => {
        JSON.parse(response.body);
      }, 'Response body should be valid JSON');
    });

    it('should report increasing uptime on subsequent requests', async () => {
      const response1 = await makeRequest(port, '/api/health', 'GET');
      const json1 = JSON.parse(response1.body);
      const uptime1 = json1.uptime;

      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await makeRequest(port, '/api/health', 'GET');
      const json2 = JSON.parse(response2.body);
      const uptime2 = json2.uptime;

      assert.ok(uptime2 > uptime1, 'uptime should increase over time');
    });
  });

  describe('other routes', () => {
    it('should serve static files for GET /', async () => {
      const response = await makeRequest(port, '/', 'GET');
      // Should serve index.html (200) or 404 if not found
      assert.ok([200, 404].includes(response.statusCode));
    });

    it('should return 404 for unknown API routes', async () => {
      const response = await makeRequest(port, '/api/notfound', 'GET');
      assert.equal(response.statusCode, 404);
      const json = JSON.parse(response.body);
      assert.ok('error' in json);
    });

    it('should return 405 for POST to non-API routes', async () => {
      const response = await makeRequest(port, '/notfound', 'POST');
      assert.equal(response.statusCode, 405);
    });
  });

  describe('server instance', () => {
    it('should be able to start server on ephemeral port', async () => {
      const testServer = createHTTPServer(null);

      await new Promise((resolve) => {
        testServer.listen(0, () => {
          const ephemeralPort = testServer.address().port;
          assert.ok(ephemeralPort > 0, 'Should bind to a port');
          testServer.close(() => resolve());
        });
      });
    });

    it('should handle graceful shutdown', async () => {
      const testServer = createHTTPServer(null);

      await new Promise((resolve) => {
        testServer.listen(0, () => {
          testServer.close(() => {
            resolve();
          });
        });
      });
    });
  });
});
