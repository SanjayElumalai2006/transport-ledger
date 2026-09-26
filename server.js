/**
 * Transport Ledger - Enterprise REST API & Application Server
 * High-performance Node.js server with MongoDB Atlas cloud database support,
 * automated atomic local fallback, LAN multi-device sync, and full transport workflow APIs.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleApiRequest, sendError } from './api/router.js';
import * as db from './lib/db.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Get list of local IPv4 network addresses
function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Static File Server
function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: if not found, check if it's an SPA route
      const indexPath = path.join(__dirname, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': indexStats.size,
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(indexPath).pipe(res);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Main HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // API ROUTER: /api/*
    if (pathname.startsWith('/api/') || pathname === '/api') {
      const networkIps = getNetworkAddresses();
      const handled = await handleApiRequest(req, res, pathname, method, networkIps, PORT);
      if (!handled) {
        sendError(res, 404, `API route not found: ${method} ${pathname}`);
      }
      return;
    }

    // STATIC ASSETS ROUTER
    serveStaticFile(req, res, pathname);
  } catch (err) {
    console.error('Unhandled Server Exception:', err);
    sendError(res, 500, 'Internal Server Error: ' + err.message);
  }
});

// Start HTTP Server
server.listen(PORT, '0.0.0.0', async () => {
  const localIps = getNetworkAddresses();
  const dbStatus = await db.getDbStatus();

  console.log('\n================================================================');
  console.log('  🚛 TRANSPORT LEDGER - ENTERPRISE BACKEND SERVER STARTED');
  console.log('================================================================');
  console.log(`  Local Computer:    http://localhost:${PORT}/`);
  localIps.forEach(ip => {
    console.log(`  Mobile / LAN URL:  http://${ip}:${PORT}/`);
  });
  console.log(`  REST API Status:   http://localhost:${PORT}/api/status`);
  console.log(`  Database Engine:   ${dbStatus.engine} (${dbStatus.storageLocation})`);
  console.log('================================================================\n');
});

// Handle graceful process shutdown
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Stopping Transport Ledger Server...`);
  server.close(() => {
    console.log('Server stopped cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default server;
