/**
 * ws-proxy/src/index.js
 * Meki WS Proxy — Entry point (HTTP + WebSocket server bootstrap)
 * server.js (Express + JWT session) and ws-handler.js (GitHub API relay) を統合
 */

'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { createApp } = require('./server');
const { handleWsConnection } = require('./ws-handler');

const PORT = process.env.PORT || 8080;

// Express app をHTTPサーバーに統合 (server.js の /health, /api/session が有効化)
const app = createApp();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    handleWsConnection(ws, req);
});

server.listen(PORT, () => {
    console.log(`[ws-proxy] Listening on port ${PORT}`);
});

