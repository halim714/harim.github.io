/**
 * ws-proxy/src/server.js
 * Meki WS Proxy — Express HTTP server + JWT session management
 *
 * Endpoints:
 *   GET  /health          — liveness check
 *   POST /api/session     — exchange GitHub token for a signed JWT
 *   GET  /api/session     — verify JWT and return session info
 *   DELETE /api/session   — invalidate session (client-side)
 *
 * Environment variables:
 *   JWT_SECRET   — signing secret (required in production)
 *   JWT_EXPIRES  — token TTL (default: '8h')
 *   PORT         — HTTP port (default: 8080, overridden by index.js)
 */

'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { Octokit } = require('@octokit/rest');

// ─── Config ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'meki-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

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
 * Validate and decode the JWT from the Authorization header.
 * Attaches decoded payload to req.session on success.
 */
function requireSession(req, res, next) {
    const token = extractBearer(req);
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
 *
 * Request body: { token: "<github_access_token>" }
 * Response:     { sessionToken, expiresIn, user: { login, id, avatar_url } }
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

    const payload = {
        sub: String(user.id),
        login: user.login,
        // Store the GitHub token in the JWT so WS handler can use it.
        // In production, prefer encrypting or storing server-side.
        ghToken: githubToken
    };

    const sessionToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.status(201).json({
        sessionToken,
        expiresIn: JWT_EXPIRES,
        user: { login: user.login, id: user.id, avatar_url: user.avatar_url }
    });
});

/**
 * GET /api/session
 * Verify an existing JWT and return the decoded session info.
 *
 * Authorization: Bearer <sessionToken>
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
 * JWTs are stateless — actual invalidation is client-side (discard token).
 * A token blocklist can be added here if needed in the future.
 *
 * Authorization: Bearer <sessionToken>
 * Response: { success: true }
 */
router.delete('/api/session', requireSession, (req, res) => {
    console.log(`[server] Session ended for user: ${req.session.login}`);
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

module.exports = { createApp };
