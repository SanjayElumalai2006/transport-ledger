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
 * Generates an SVG image with distorted text, noise lines, and HMAC-signed token.
 */
export function generateCaptcha() {
  // Characters excluding easily confused ones (0, O, I, 1, l)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let captchaCode = '';
  for (let i = 0; i < 5; i++) {
    captchaCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const timestamp = Date.now();
  const tokenPayload = `${captchaCode.toUpperCase()}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', CAPTCHA_SECRET).update(tokenPayload).digest('hex');
  const token = `${timestamp}:${hmac}`;

  // Build colorful distorted SVG
  const width = 160;
  const height = 48;
  const colors = ['#047857', '#0369a1', '#b45309', '#9333ea', '#c2410c', '#0f766e'];

  // Draw background noise lines
  let linesSvg = '';
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    const col = colors[i % colors.length];
    linesSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.5" stroke-opacity="0.35" />`;
  }

  // Draw scattered noise dots
  let dotsSvg = '';
  for (let i = 0; i < 20; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    dotsSvg += `<circle cx="${cx}" cy="${cy}" r="1.5" fill="#94a3b8" opacity="0.4" />`;
  }

  // Draw text characters with rotation & slight offset
  let charsSvg = '';
  for (let i = 0; i < captchaCode.length; i++) {
    const char = captchaCode[i];
    const x = 20 + i * 26 + (Math.random() * 4 - 2);
    const y = 32 + (Math.random() * 6 - 3);
    const rot = Math.floor(Math.random() * 28 - 14); // -14 to +14 deg
    const col = colors[Math.floor(Math.random() * colors.length)];
    charsSvg += `<text x="${x}" y="${y}" font-family="'Outfit', 'Courier New', monospace" font-size="24" font-weight="bold" fill="${col}" transform="rotate(${rot}, ${x}, ${y})">${char}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f8fafc; border-radius:8px; border:1px solid #cbd5e1; user-select:none;">
    ${linesSvg}
    ${dotsSvg}
    ${charsSvg}
  </svg>`;

  return {
    token,
    svg: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    expiresIn: 300 // 5 minutes
  };
}

/**
 * Verify user submitted CAPTCHA answer against token
 */
export function verifyCaptcha(token, answer) {
  if (!token || !answer) return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [timestampStr, expectedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);

  // Check 5 minute expiration window
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    return false; // Expired
  }

  const cleanAnswer = answer.trim().toUpperCase();
  const tokenPayload = `${cleanAnswer}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', CAPTCHA_SECRET).update(tokenPayload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
}
