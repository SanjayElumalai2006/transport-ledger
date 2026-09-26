/**
 * Transport Ledger - Authentication & Security Engine
 * Features: PBKDF2 Password Hashing, Cryptographic Sessions,
 * Anti-Bot Visual/Math CAPTCHA Generation & Verification, and Google OAuth support.
 */

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'transport-ledger-secure-key-2026';
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || 'transport-captcha-salt-987';

/**
 * Hash password with PBKDF2 and random cryptographic salt
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verify password against stored salt and hash
 */
export function verifyPassword(password, salt, storedHash) {
  if (!password || !salt || !storedHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Create a signed, stateless session token
 */
export function createSessionToken(user) {
  const payload = {
    userId: user.id || user._id,
    email: user.email,
    name: user.name,
    businessName: user.businessName || '',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verify session token and extract user payload
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');

  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Generate a visual Anti-Bot CAPTCHA for new user registration
 * Generates a clean, highly legible SVG image with distinct colors and cryptographic verification token.
 * Uses an unambiguous character set (no 0/O, 1/I, 2/Z, 5/S, 8/B, V/U confusion).
 */
export function generateCaptcha() {
  // 100% visually distinct characters (no confusable pairs)
  const chars = '34679ACDEFHKMNPRTWXY';
  let captchaCode = '';
  for (let i = 0; i < 5; i++) {
    captchaCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const timestamp = Date.now();
  const tokenPayload = `${captchaCode.toUpperCase()}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', CAPTCHA_SECRET).update(tokenPayload).digest('hex');
  const token = `${timestamp}:${hmac}`;

  // Crisp visual dimensions
  const width = 160;
  const height = 48;
  const colors = ['#047857', '#0369a1', '#b45309', '#7c3aed', '#c2410c', '#0f766e'];

  // Gentle background subtle lines
  let linesSvg = '';
  for (let i = 0; i < 2; i++) {
    const x1 = Math.floor(Math.random() * 20);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(width - Math.random() * 20);
    const y2 = Math.floor(Math.random() * height);
    const col = colors[i % colors.length];
    linesSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.2" stroke-opacity="0.25" />`;
  }

  // Draw 5 clean characters with slight rotation for Anti-Bot and 100% clarity
  let charsSvg = '';
  for (let i = 0; i < captchaCode.length; i++) {
    const char = captchaCode[i];
    const x = 16 + i * 28;
    const y = 33;
    const rot = Math.floor(Math.random() * 10 - 5); // Subtle -5 to +5 deg tilt
    const col = colors[i % colors.length];
    charsSvg += `<text x="${x}" y="${y}" font-family="'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="25" font-weight="800" fill="${col}" transform="rotate(${rot}, ${x + 8}, ${y - 8})">${char}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f8fafc; border-radius:6px; border:1px solid #cbd5e1; user-select:none; display:block;">
    ${linesSvg}
    ${charsSvg}
  </svg>`;

  const base64Svg = Buffer.from(svg).toString('base64');

  return {
    token,
    rawSvg: svg,
    svg: `data:image/svg+xml;base64,${base64Svg}`,
    expiresIn: 900 // 15 minutes
  };
}

/**
 * Verify user submitted CAPTCHA answer against token
 * Supports both server HMAC tokens and client-side fallback tokens.
 */
export function verifyCaptcha(token, answer) {
  if (!token || !answer) return false;

  const cleanAnswer = answer.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!cleanAnswer) return false;

  // 1. Support client-side fallback tokens (client:timestamp:hash)
  if (token.startsWith('client:')) {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const timestamp = parseInt(parts[1], 10);
    if (isNaN(timestamp)) return false;
    const age = Date.now() - timestamp;
    if (age > 15 * 60 * 1000 || age < -60 * 1000) return false;

    const payload = `${cleanAnswer}:${timestamp}:transport_sec`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36) === parts[2];
  }

  // 2. Standard server HMAC tokens (timestamp:hmac)
  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [timestampStr, expectedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check 15 minute expiration window with 1 minute skew tolerance
  const age = Date.now() - timestamp;
  if (age > 15 * 60 * 1000 || age < -60 * 1000) {
    return false; // Expired
  }

  const tokenPayload = `${cleanAnswer}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', CAPTCHA_SECRET).update(tokenPayload).digest('hex');

  const hmacBuf = Buffer.from(hmac, 'hex');
  const expBuf = Buffer.from(expectedHmac, 'hex');
  if (hmacBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(hmacBuf, expBuf);
}



