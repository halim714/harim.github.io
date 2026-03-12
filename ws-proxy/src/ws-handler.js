/**
 * ws-proxy/src/ws-handler.js
 * Meki WS Proxy — WebSocket connection handler + GitHub API relay
 *
 * Message protocol:
 *   Client → Server: { id, action, token, payload }
 *   Server → Client: { id, success, data }  |  { id, success: false, error, code }
 *
 * Supported actions:
 *   github.getFile            — get single file content + sha
 *   github.getFiles           — list directory contents
 *   github.getFilesWithMeta   — GraphQL: batch files with content (avoids N+1)
 *   github.createOrUpdateFile — create / update file (SHA auto-resolved)
 *   github.deleteFile         — delete file by path + sha
 *   github.getUser            — get authenticated user info
 *   github.getRepo            — get repository info
 *   github.createRepo         — create new repository
 *   github.getLastCommitDate  — last commit date for a path
 *   ping                      — connectivity check
 */

'use strict';

const { Octokit } = require('@octokit/rest');
const { getGitHubToken, decryptToken } = require('./server');

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_MESSAGE_BYTES = 1 * 1024 * 1024; // 1 MB guard
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const JWT_SECRET = process.env.JWT_SECRET || 'meki-dev-secret-change-in-production';

// ─── Client registry (per-login broadcast) ─────────────────────────────────

const clientsByLogin = new Map(); // login → Set<WebSocket>

function registerClient(login, ws) {
    if (!clientsByLogin.has(login)) clientsByLogin.set(login, new Set());
    clientsByLogin.get(login).add(ws);
}

function deregisterClient(login, ws) {
    const set = clientsByLogin.get(login);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) clientsByLogin.delete(login);
}

function broadcastToLogin(login, senderWs, message) {
    const set = clientsByLogin.get(login);
    if (!set) return;
    const payload = JSON.stringify(message);
    for (const ws of set) {
        if (ws !== senderWs && ws.readyState === ws.OPEN) {
            try { ws.send(payload); } catch { /* ignore dead socket */ }
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Node.js-compatible UTF-8 → Base64 encode.
 * Mirrors GitHubService.encodeContent() from the frontend.
 */
function encodeContent(str) {
    return Buffer.from(str, 'utf8').toString('base64');
}

/**
 * Build a success response envelope.
 */
function ok(id, data) {
    return JSON.stringify({ id, success: true, data });
}

/**
 * Build an error response envelope.
 */
function fail(id, error, code = 'GITHUB_API_ERROR') {
    return JSON.stringify({ id, success: false, error: String(error), code });
}

/**
 * Create an Octokit instance authenticated with the given token.
 * Tokens are per-message so a single WS connection can serve one user.
 */
function makeOctokit(token) {
    return new Octokit({
        auth: token,
        retry: { doNotRetry: [400, 401, 403, 404, 409, 410, 422, 451] }
    });
}

// ─── Action handlers ───────────────────────────────────────────────────────

/**
 * Get a single file from GitHub.
 * payload: { repoName, path, owner? }
 * returns: { name, path, sha, content (decoded utf-8), size, html_url }
 */
async function handleGetFile(octokit, username, payload) {
    const { repoName, path, owner } = payload;
    const { data } = await octokit.rest.repos.getContent({
        owner: owner || username,
        repo: repoName,
        path
    });

    if (Array.isArray(data)) {
        throw Object.assign(new Error(`Expected file, got directory at: ${path}`), { code: 'NOT_A_FILE' });
    }
    if (data.type !== 'file') {
        throw Object.assign(new Error(`Not a file at: ${path} (type=${data.type})`), { code: 'NOT_A_FILE' });
    }

    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { name: data.name, path: data.path, sha: data.sha, content, size: data.size, html_url: data.html_url };
}

/**
 * List directory contents.
 * payload: { repoName, path, owner? }
 * returns: Array<{ name, path, sha, type, size }>
 */
async function handleGetFiles(octokit, username, payload) {
    const { repoName, path, owner } = payload;
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: owner || username,
            repo: repoName,
            path: path || ''
        });

        const entries = Array.isArray(data) ? data : [data];
        return entries.map(({ name, path: p, sha, type, size, html_url }) => ({
            name, path: p, sha, type, size, html_url
        }));
    } catch (error) {
        if (error.status === 404) return [];
        throw error;
    }
}

/**
 * GraphQL batch fetch — files + content in one round-trip (avoids N+1).
 * payload: { repoName, path, owner? }
 * returns: Array<{ name, sha, text }>
 */
async function handleGetFilesWithMeta(octokit, username, payload) {
    const { repoName, path, owner } = payload;

    const query = `
        query getPosts($owner: String!, $repo: String!, $expression: String!) {
            repository(owner: $owner, name: $repo) {
                object(expression: $expression) {
                    ... on Tree {
                        entries {
                            name
                            oid
                            object {
                                ... on Blob { text }
                            }
                        }
                    }
                }
            }
        }
    `;

    const response = await octokit.graphql(query, {
        owner: owner || username,
        repo: repoName,
        expression: `HEAD:${path}`
    });

    const entries = response.repository?.object?.entries;
    if (!entries) return [];

    return entries.map(entry => ({
        name: entry.name,
        path: `${path}/${entry.name}`,
        sha: entry.oid,
        text: entry.object?.text || ''
    }));
}

/**
 * Create or update a file (SHA auto-resolved).
 * payload: { repoName, path, content, message, sha?, owner?, skipShaLookup? }
 * returns: { sha } — new SHA after write
 */
async function handleCreateOrUpdateFile(octokit, username, payload) {
    const { repoName, path, content, message, sha: providedSha, owner, skipShaLookup } = payload;
    const repoOwner = owner || username;
    let currentSha = providedSha || null;

    // Auto-resolve SHA if not provided and lookup is not skipped
    if (!currentSha && !skipShaLookup) {
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner: repoOwner,
                repo: repoName,
                path
            });
            currentSha = data.sha;
        } catch (error) {
            if (error.status !== 404) throw error;
            // 404 = new file, proceed without SHA
        }
    }

    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
        owner: repoOwner,
        repo: repoName,
        path,
        message,
        content: encodeContent(content),
        ...(currentSha ? { sha: currentSha } : {})
    });

    return { sha: data.content.sha };
}

/**
 * Delete a file.
 * payload: { repoName, path, message, sha, owner? }
 * returns: { deleted: true }
 */
async function handleDeleteFile(octokit, username, payload) {
    const { repoName, path, message, sha, owner } = payload;
    await octokit.rest.repos.deleteFile({
        owner: owner || username,
        repo: repoName,
        path,
        message,
        sha
    });
    return { deleted: true };
}

/**
 * Get authenticated user info.
 * payload: {}
 * returns: { login, id, avatar_url, html_url }
 */
async function handleGetUser(octokit) {
    const { data } = await octokit.rest.users.getAuthenticated();
    return { login: data.login, id: data.id, avatar_url: data.avatar_url, html_url: data.html_url };
}

/**
 * Get repository info.
 * payload: { repoName, owner? }
 * returns: { full_name, private, default_branch, html_url }
 */
async function handleGetRepo(octokit, username, payload) {
    const { repoName, owner } = payload;
    const { data } = await octokit.rest.repos.get({
        owner: owner || username,
        repo: repoName
    });
    return {
        full_name: data.full_name,
        private: data.private,
        default_branch: data.default_branch,
        html_url: data.html_url
    };
}

/**
 * Create a new repository.
 * payload: { name, description?, private?, autoInit? }
 * returns: { full_name, html_url, clone_url }
 */
async function handleCreateRepo(octokit, payload) {
    const { name, description = '', private: isPrivate = false, autoInit = true } = payload;
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: autoInit
    });
    return { full_name: data.full_name, html_url: data.html_url, clone_url: data.clone_url };
}

/**
 * Get last commit date for a path.
 * payload: { repoName, path, owner? }
 * returns: { date } | { date: null }
 */
async function handleGetLastCommitDate(octokit, username, payload) {
    const { repoName, path, owner } = payload;
    try {
        const { data } = await octokit.rest.repos.listCommits({
            owner: owner || username,
            repo: repoName,
            path,
            per_page: 1
        });
        const date = data.length > 0 ? data[0].commit.committer.date : null;
        return { date };
    } catch {
        return { date: null };
    }
}

// ─── Action dispatcher ─────────────────────────────────────────────────────

const ACTION_HANDLERS = {
    'github.getFile': handleGetFile,
    'github.getFiles': handleGetFiles,
    'github.getFilesWithMeta': handleGetFilesWithMeta,
    'github.createOrUpdateFile': handleCreateOrUpdateFile,
    'github.deleteFile': handleDeleteFile,
    'github.getUser': handleGetUser,
    'github.getRepo': handleGetRepo,
    'github.createRepo': handleCreateRepo,
    'github.getLastCommitDate': handleGetLastCommitDate
};

/**
 * Dispatch a parsed message to the appropriate handler.
 * Returns a JSON string to send back to the client.
 * @param {import('ws').WebSocket} ws - Connection object with ws.ghToken bound
 * @param {object} msg - Parsed message from client
 */
async function dispatch(ws, msg) {
    const { id, action, payload = {} } = msg;

    if (action === 'ping') {
        return ok(id, { pong: true, ts: Date.now() });
    }

    const resolvedToken = ws.ghToken;
    if (!resolvedToken) {
        return fail(id, 'Missing authentication token', 'UNAUTHENTICATED');
    }

    // sync.notify: broadcast metadata to other devices of same user
    if (action === 'sync.notify') {
        if (ws.wsLogin) {
            broadcastToLogin(ws.wsLogin, ws, {
                type: 'sync:changed',
                ts: Date.now(),
                ...payload  // action, phase, docId, title, filename, updatedAt, sha
            });
        }
        return ok(id, { notified: true });
    }

    const handler = ACTION_HANDLERS[action];
    if (!handler) {
        return fail(id, `Unknown action: ${action}`, 'UNKNOWN_ACTION');
    }

    try {
        const octokit = makeOctokit(resolvedToken);

        // Resolve username for actions that need it
        let username = null;
        if (action !== 'github.createRepo' && action !== 'github.getUser') {
            const { data } = await octokit.rest.users.getAuthenticated();
            username = data.login;
        }

        let data;
        if (action === 'github.createRepo') {
            data = await handler(octokit, payload);
        } else if (action === 'github.getUser') {
            data = await handler(octokit);
        } else {
            data = await handler(octokit, username, payload);
        }

        return ok(id, data);
    } catch (error) {
        const statusCode = error.status;
        if (statusCode === 401 || statusCode === 403) {
            return fail(id, 'GitHub authentication failed', 'AUTH_ERROR');
        }
        if (statusCode === 404) {
            return fail(id, `Resource not found: ${error.message}`, 'NOT_FOUND');
        }
        if (statusCode === 409) {
            return fail(id, `Conflict: ${error.message}`, 'CONFLICT');
        }
        if (statusCode === 422) {
            return fail(id, `Validation failed: ${error.message}`, 'VALIDATION_ERROR');
        }
        return fail(id, error.message || 'GitHub API error', error.code || 'GITHUB_API_ERROR');
    }
}

// ─── Connection handler ────────────────────────────────────────────────────

/**
 * Handle a new WebSocket connection.
 * Called from index.js: wss.on('connection', handleWsConnection)
 *
 * @param {import('ws').WebSocket} ws
 * @param {import('http').IncomingMessage} req
 */
function handleWsConnection(ws, req) {
    const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[ws-handler] Client connected: ${remoteIp}`);

    ws.ghToken = null;
    ws.wsLogin = null;
    let authCompleted = false;

    // ── Heartbeat ──────────────────────────────────────────────────────────
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const heartbeat = setInterval(() => {
        if (!ws.isAlive) {
            console.log(`[ws-handler] Client timed out: ${remoteIp}`);
            clearInterval(heartbeat);
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        if (ws.readyState === ws.OPEN) {
            ws.ping();
            // Terminate if no pong within HEARTBEAT_TIMEOUT_MS
            setTimeout(() => {
                if (!ws.isAlive && ws.readyState === ws.OPEN) {
                    ws.terminate();
                }
            }, HEARTBEAT_TIMEOUT_MS);
        }
    }, HEARTBEAT_INTERVAL_MS);

    ws.on('close', () => {
        clearInterval(heartbeat);
        if (ws.wsLogin) deregisterClient(ws.wsLogin, ws);
        console.log(`[ws-handler] Client disconnected: ${remoteIp}`);
    });

    ws.on('error', (err) => {
        clearInterval(heartbeat);
        if (ws.wsLogin) deregisterClient(ws.wsLogin, ws);
        console.error(`[ws-handler] Error from ${remoteIp}:`, err.message);
    });

    // ── Message handling ────────────────────────────────────────────────────
    ws.on('message', async (raw) => {
        // Size guard
        if (raw.length > MAX_MESSAGE_BYTES) {
            ws.send(fail(null, 'Message too large', 'MESSAGE_TOO_LARGE'));
            return;
        }

        let msg;
        try {
            msg = JSON.parse(raw.toString('utf8'));
        } catch {
            ws.send(fail(null, 'Invalid JSON', 'PARSE_ERROR'));
            return;
        }

        if (!msg.id) {
            ws.send(fail(null, 'Missing required field: id', 'BAD_REQUEST'));
            return;
        }

        // P6.1: Connection must authenticate with 'auth' action first
        if (!authCompleted) {
            if (msg.action !== 'auth' || !msg.token) {
                ws.send(fail(msg.id, 'Authentication required before sending commands', 'UNAUTHENTICATED'));
                ws.close();
                return;
            }

            try {
                const jwtPayload = require('jsonwebtoken').verify(msg.token, JWT_SECRET);
                // sessionStore 우선 (메모리 있음), 없으면 JWT 내 enc_token 복호화 (서버 재시작 후)
                let ghToken = getGitHubToken(jwtPayload.sid);
                if (!ghToken && jwtPayload.enc_token) {
                    ghToken = decryptToken(jwtPayload.enc_token);
                }
                if (!ghToken) throw new Error('Session not found or expired');
                ws.ghToken = ghToken;
                ws.wsLogin = jwtPayload.login;
                authCompleted = true;
                registerClient(ws.wsLogin, ws);
                ws.send(ok(msg.id, { authenticated: true, login: ws.wsLogin }));
                console.log(`[ws-handler] Client authenticated: ${remoteIp} (user: ${ws.wsLogin})`);
                return;
            } catch (err) {
                ws.send(fail(msg.id, 'Invalid or expired session', 'UNAUTHENTICATED'));
                ws.close();
                return;
            }
        }

        if (!msg.action) {
            ws.send(fail(msg.id, 'Missing required field: action', 'BAD_REQUEST'));
            return;
        }

        try {
            const response = await dispatch(ws, msg);
            if (ws.readyState === ws.OPEN) {
                ws.send(response);
            }
        } catch (unexpectedError) {
            console.error('[ws-handler] Unexpected dispatch error:', unexpectedError);
            if (ws.readyState === ws.OPEN) {
                ws.send(fail(msg.id, 'Internal server error', 'INTERNAL_ERROR'));
            }
        }
    });
}

module.exports = { handleWsConnection };
