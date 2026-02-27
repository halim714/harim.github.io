/**
 * ws-proxy/src/index.js
 * Meki WS Proxy — Entry point (HTTP + WebSocket server bootstrap)
 * Actual server logic lives in server.js (P2-T2) and ws-handler.js (P2-T3)
 */

'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { handleWsConnection } = require('./ws-handler');

const PORT = process.env.PORT || 8080;

// Minimal HTTP server (full Express server implemented in P2-T2)
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'meki-ws-proxy' }));
        return;
    }
    res.writeHead(404);
    res.end('Not Found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    handleWsConnection(ws, req);
});

server.listen(PORT, () => {
    console.log(`[ws-proxy] Listening on port ${PORT}`);
});
