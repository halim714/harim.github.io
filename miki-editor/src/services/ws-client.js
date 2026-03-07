/**
 * src/services/ws-client.js
 * Meki WS Proxy Client — singleton WebSocket connection manager
 *
 * Protocol (matches ws-proxy/src/ws-handler.js):
 *   Client → Server: { id, action, payload }  (auth via HttpOnly cookie)
 *   Server → Client: { id, success, data }  |  { id, success: false, error, code }
 *
 * Usage:
 *   import { getWsClient } from './ws-client';
 *   const data = await getWsClient().request('github.getFile', { repoName, path });
 */

const WS_PROXY_URL = import.meta.env.VITE_WS_PROXY_URL || 'ws://localhost:8080';
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;

/** @type {WsClient|null} */
let _instance = null;

/** Session ID received from POST /api/session — included in every WS message */
let _sessionId = null;

/**
 * Set the session ID to include in WS messages.
 * Called by CallbackPage after successful WS-mode login.
 * @param {string} sid
 */
export function setSessionId(sid) {
    _sessionId = sid;
}

export class WsClient {
    constructor(url) {
        this._url = url;
        /** @type {WebSocket|null} */
        this._ws = null;
        /** @type {Map<string, { resolve: Function, reject: Function, timer: ReturnType<typeof setTimeout> }>} */
        this._pending = new Map();
        this._reconnectDelay = RECONNECT_BASE_MS;
        this._intentionalClose = false;
        /** @type {Promise<WebSocket|null>|null} */
        this._connectingPromise = null;

        this._connect();
    }

    // ── Connection management ──────────────────────────────────────────────

    _connect() {
        if (this._connectingPromise) return this._connectingPromise;
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            return Promise.resolve(this._ws);
        }

        this._intentionalClose = false;

        this._connectingPromise = new Promise((resolve) => {
            const ws = new WebSocket(this._url);

            ws.addEventListener('open', () => {
                console.log('[ws-client] Connected to', this._url);
                this._ws = ws;
                this._reconnectDelay = RECONNECT_BASE_MS;
                this._connectingPromise = null;
                resolve(ws);
            });

            ws.addEventListener('message', (event) => {
                let msg;
                try {
                    msg = JSON.parse(event.data);
                } catch {
                    console.warn('[ws-client] Invalid JSON from server');
                    return;
                }

                const entry = this._pending.get(msg.id);
                if (!entry) return; // unsolicited or already timed out

                clearTimeout(entry.timer);
                this._pending.delete(msg.id);

                if (msg.success) {
                    entry.resolve(msg.data);
                } else {
                    const err = Object.assign(new Error(msg.error || 'WS request failed'), {
                        code: msg.code,
                        wsError: true
                    });
                    entry.reject(err);
                }
            });

            ws.addEventListener('close', () => {
                // If we never opened, resolve with null to unblock any waiting callers
                if (this._connectingPromise) {
                    this._connectingPromise = null;
                    resolve(null);
                }
                this._ws = null;
                this._rejectAllPending('WebSocket connection closed');
                if (!this._intentionalClose) {
                    this._scheduleReconnect();
                }
            });

            ws.addEventListener('error', () => {
                console.warn('[ws-client] WebSocket error — will reconnect');
            });
        });

        return this._connectingPromise;
    }

    _scheduleReconnect() {
        const delay = this._reconnectDelay;
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS);
        console.log(`[ws-client] Reconnecting in ${delay}ms…`);
        setTimeout(() => {
            if (!this._intentionalClose) this._connect();
        }, delay);
    }

    _rejectAllPending(reason) {
        for (const [, entry] of this._pending) {
            clearTimeout(entry.timer);
            entry.reject(new Error(reason));
        }
        this._pending.clear();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Send a request to the WS proxy and return the response data.
     * Authentication is handled via HttpOnly cookie (meki_session) set by POST /api/session.
     *
     * @param {string} action - Action name (e.g. 'github.getFile')
     * @param {object} [payload] - Action-specific payload
     * @returns {Promise<object>} Resolved response data from server
     */
    async request(action, payload = {}) {
        let ws = this._ws;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            ws = await this._connect();
        }

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('[ws-client] Not connected to WS proxy');
        }

        const id = `meki-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const message = JSON.stringify({ id, action, payload, sessionId: _sessionId });

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error(`[ws-client] Request timed out: ${action}`));
            }, REQUEST_TIMEOUT_MS);

            this._pending.set(id, { resolve, reject, timer });
            ws.send(message);
        });
    }

    /**
     * Close the connection intentionally (no reconnect).
     */
    close() {
        this._intentionalClose = true;
        this._rejectAllPending('Connection closed');
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
    }

    /** @returns {boolean} */
    get isConnected() {
        return this._ws?.readyState === WebSocket.OPEN;
    }
}

/**
 * Get (or create) the singleton WsClient instance.
 * @returns {WsClient}
 */
export function getWsClient() {
    if (!_instance) {
        _instance = new WsClient(WS_PROXY_URL);
    }
    return _instance;
}
