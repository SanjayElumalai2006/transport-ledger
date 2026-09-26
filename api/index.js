/**
 * Vercel Serverless Function Handler for Transport Ledger
 * Directs all /api/* requests to the unified API Router with MongoDB support.
 */

import { handleApiRequest, sendError } from './router.js';

export default async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const parsedUrl = new URL(req.url, `${proto}://${host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    const handled = await handleApiRequest(req, res, pathname, method, [], 443);
    if (!handled) {
      sendError(res, 404, `API endpoint not found: ${method} ${pathname}`);
    }
  } catch (err) {
    console.error('[Vercel API Handler Error]:', err);
    sendError(res, 500, 'Internal Server Error: ' + err.message);
  }
}
