#!/usr/bin/env node
/**
 * Samsung Notes Local App Bridge
 *
 * 사용법:
 *   node bridge-server.js <sdocx-파일-또는-디렉토리> [...]
 *
 * 예시:
 *   node bridge-server.js ~/Downloads/notes/
 *   node bridge-server.js note1.sdocx note2.sdocx
 *
 * Windows에서는 PowerShell 래퍼(.ps1 또는 .exe)가 이 스크립트를 호출함
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { extractFromFiles, findSdocxFiles } = require('./extract');
const { PROTOCOL_VERSION, STORAGE_KEY, BRIDGE_TIMEOUT_MS } = require('../shared/protocol');

const MEKI_IMPORT_URL = process.env.MEKI_URL || 'https://app.meki.com/import-bridge';

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('사용법: node bridge-server.js <경로> [...]');
    console.error('Samsung Notes에서 .sdocx 파일로 내보낸 후 경로를 지정하세요.');
    process.exit(1);
  }

  // 파일 목록 수집
  const sdocxFiles = [];
  for (const arg of args) {
    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved)) {
      console.warn(`[skip] 경로 없음: ${resolved}`);
      continue;
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      sdocxFiles.push(...findSdocxFiles(resolved));
    } else if (resolved.endsWith('.sdocx')) {
      sdocxFiles.push(resolved);
    }
  }

  if (!sdocxFiles.length) {
    console.error('.sdocx 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`[MekiSync] ${sdocxFiles.length}개 .sdocx 파일 처리 중...`);
  let notes;
  try {
    notes = await extractFromFiles(sdocxFiles);
    console.log(`[MekiSync] ${notes.length}개 노트 추출 완료`);
  } catch (err) {
    console.error('[MekiSync] 추출 실패:', err.message);
    process.exit(1);
  }

  const payload = {
    version: PROTOCOL_VERSION,
    source: 'samsung_notes',
    notes,
    exportedAt: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify(payload);

  // 일회성 HTTP 서버
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildBridgePage(payloadJson, MEKI_IMPORT_URL, STORAGE_KEY));
    } else {
      res.writeHead(404);
      res.end();
    }
    setTimeout(() => { server.close(); process.exit(0); }, 500);
  });

  const timeout = setTimeout(() => {
    console.log('[MekiSync] 타임아웃 — 서버 종료');
    server.close();
    process.exit(0);
  }, BRIDGE_TIMEOUT_MS);

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/`;
    console.log(`[MekiSync] 브라우저 열기: ${url}`);
    // 플랫폼별 브라우저 오픈
    const openCmd = process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    exec(openCmd);
    timeout.refresh();
  });
}

function buildBridgePage(payloadJson, redirectUrl, storageKey) {
  const escaped = payloadJson.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Meki 노트 가져오기</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #f5f5f7; }
    .box { text-align: center; padding: 2rem; background: white;
           border-radius: 1rem; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    p { color: #555; margin: .5rem 0; }
  </style>
</head>
<body>
  <div class="box">
    <p>Samsung Notes를 Meki로 전달하는 중...</p>
    <p style="font-size:.85rem;color:#aaa">잠시 후 Meki로 이동합니다</p>
  </div>
  <script>
    try {
      localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(escaped)});
    } catch(e) {}
    location.href = ${JSON.stringify(redirectUrl)};
  </script>
</body>
</html>`;
}

main().catch(err => {
  console.error('[MekiSync] 오류:', err.message);
  process.exit(1);
});
