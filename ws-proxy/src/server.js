/**
 * ws-proxy/src/server.js
 * Meki WS Proxy — Express HTTP server + Stateless JWT session (AES-256-GCM)
 *
 * Endpoints:
 *   GET  /health          — liveness check
 *   POST /api/session     — exchange GitHub token for a signed JWT (enc_token)
 *   GET  /api/session     — verify JWT and return session info
 *   DELETE /api/session   — invalidate session (client-side)
 *
 * Environment variables:
 *   JWT_SECRET      — signing secret (required in production)
 *   JWT_EXPIRES     — token TTL (default: '8h')
 *   ENCRYPTION_KEY  — AES-256-GCM key material (required in production)
 *   PORT            — HTTP port (default: 8080, overridden by index.js)
 */

'use strict';

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Octokit } = require('@octokit/rest');

// ─── Config ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'meki-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

const ALLOWED_ORIGINS = [
    process.env.ALLOWED_ORIGIN || 'https://miki-editor.vercel.app',
    /^https:\/\/miki-.*\.vercel\.app$/,
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
];

// ─── AES-256-GCM Token Encryption (P6-T1: Stateless) ──────────────────────
// ghToken은 서버 메모리가 아닌 JWT payload에 암호화되어 저장됨 (서버 재시작 내성)

const ENCRYPTION_KEY = (() => {
    const raw = process.env.ENCRYPTION_KEY || 'meki-dev-enc-key-change-in-production';
    return crypto.scryptSync(raw, 'meki-salt', 32); // 32바이트 AES-256 키
})();

/**
 * AES-256-GCM으로 평문 문자열을 암호화.
 * @param {string} plainText
 * @returns {string} base64 encoded [iv(12) + tag(16) + ciphertext]
 */
function encryptToken(plainText) {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * AES-256-GCM으로 암호화된 base64 문자열을 복호화.
 * @param {string} encoded
 * @returns {string} plainText
 */
function decryptToken(encoded) {
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract Bearer token from Authorization header.
 * Returns null if header is missing or malformed.
 */
function extractBearer(req) {
    const auth = req.headers['authorization'] || '';
    if (!auth.startsWith('Bearer ')) return null;
    return auth.slice(7).trim() || null;
}

/**
 * Verify GitHub token by calling /user and return basic user info.
 * Throws if the token is invalid or the request fails.
 */
async function verifyGitHubToken(githubToken) {
    const octokit = new Octokit({ auth: githubToken });
    const { data } = await octokit.rest.users.getAuthenticated();
    return { login: data.login, id: data.id, avatar_url: data.avatar_url };
}

// ─── Middleware ────────────────────────────────────────────────────────────

/**
 * Validate and decode the JWT from the Authorization header or HttpOnly cookie.
 * Attaches decoded payload to req.session on success.
 */
function requireSession(req, res, next) {
    const token = extractBearer(req) || (req.cookies && req.cookies.meki_session);
    if (!token) {
        return res.status(401).json({ error: 'Missing Authorization header', code: 'UNAUTHENTICATED' });
    }
    try {
        req.session = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid session token', code: 'INVALID_TOKEN' });
    }
}

// ─── Router ────────────────────────────────────────────────────────────────

const router = express.Router();

/**
 * GET /health
 * Liveness probe used by Fly.io and Docker health checks.
 */
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'meki-ws-proxy', ts: Date.now() });
});

/**
 * POST /api/session
 * Exchange a GitHub OAuth access token for a signed JWT session.
 * ghToken은 AES-256-GCM으로 암호화되어 JWT payload의 enc_token 필드에 저장됨.
 *
 * Request body: { token: "<github_access_token>" }
 * Response:     { expiresIn, user: { login, id, avatar_url } }
 */
router.post('/api/session', express.json(), async (req, res) => {
    const { token: githubToken } = req.body || {};
    if (!githubToken || typeof githubToken !== 'string') {
        return res.status(400).json({ error: 'Missing required field: token', code: 'BAD_REQUEST' });
    }

    let user;
    try {
        user = await verifyGitHubToken(githubToken);
    } catch (err) {
        const status = err.status;
        if (status === 401 || status === 403) {
            return res.status(401).json({ error: 'Invalid GitHub token', code: 'INVALID_GITHUB_TOKEN' });
        }
        console.error('[server] GitHub token verification failed:', err.message);
        return res.status(502).json({ error: 'GitHub API unavailable', code: 'GITHUB_UNAVAILABLE' });
    }

    // P6-T1: ghToken을 AES-256-GCM으로 암호화하여 JWT payload에 내장 (서버 메모리 저장 제거)
    const payload = {
        sub: String(user.id),
        login: user.login,
        enc_token: encryptToken(githubToken)
    };

    const sessionToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // HttpOnly 쿠키로 세션 토큰 설정 (CORS cross-site 호환성을 위해 SameSite=None)
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('meki_session', sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8h
        path: '/'
    });

    return res.status(201).json({
        expiresIn: JWT_EXPIRES,
        user: { login: user.login, id: user.id, avatar_url: user.avatar_url }
    });
});

/**
 * GET /api/session
 * Verify an existing JWT and return the decoded session info.
 *
 * Authorization: Bearer <sessionToken>  or  Cookie: meki_session=<sessionToken>
 * Response: { valid: true, user: { login, id }, expiresAt }
 */
router.get('/api/session', requireSession, (req, res) => {
    const { sub, login, exp } = req.session;
    res.json({
        valid: true,
        user: { login, id: sub },
        expiresAt: exp ? new Date(exp * 1000).toISOString() : null
    });
});

/**
 * DELETE /api/session
 * Signal session termination.
 * JWTs are stateless — actual invalidation is client-side (discard cookie).
 *
 * Authorization: Bearer <sessionToken>  or  Cookie: meki_session=<sessionToken>
 * Response: { success: true }
 */
router.delete('/api/session', requireSession, (req, res) => {
    console.log(`[server] Session ended for user: ${req.session.login}`);
    res.clearCookie('meki_session', { path: '/' });
    res.json({ success: true });
});

// ─── App factory ───────────────────────────────────────────────────────────

/**
 * Create and configure the Express application.
 * Exported for use in index.js and for testing.
 */
function createApp() {
    const app = express();

    // Security: hide Express fingerprint
    app.disable('x-powered-by');

    // CORS: miki-editor.vercel.app → /api/session 허용 (credentials 포함)
    app.use((req, res, next) => {
        const origin = req.headers.origin || '';
        const allowed = ALLOWED_ORIGINS.some(o =>
            o instanceof RegExp ? o.test(origin) : o === origin
        );
        if (allowed) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });

    // Parse HttpOnly session cookies
    app.use(cookieParser());

    // Routes
    app.use('/', router);

    // 404 fallback
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
    });

    // Error handler
    app.use((err, _req, res, _next) => {
        console.error('[server] Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    });

    return app;
}

module.exports = { createApp, decryptToken };
