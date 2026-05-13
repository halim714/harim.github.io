#!/usr/bin/env node
/**
 * Apple Notes Local App Bridge
 *
 * 흐름:
 * 1. osascript로 Apple Notes 추출
 * 2. localhost:PORT에서 일회성 HTTP 서버 시작
 * 3. 기본 브라우저로 자동 오픈
 * 4. 브라우저가 데이터 수신 → meki import-bridge로 리다이렉트
 * 5. 서버 자동 종료
 */

const http = require('http');
const { execFile, exec } = require('child_process');
const path = require('path');
const { PROTOCOL_VERSION, STORAGE_KEY, BRIDGE_TIMEOUT_MS } = require('../shared/protocol');

const MEKI_IMPORT_URL = process.env.MEKI_URL || 'https://app.meki.com/import-bridge';
const PORT = 0; // OS가 사용 가능한 포트 자동 할당

async function main() {
  console.log('[MekiSync] Apple Notes 읽는 중...');

  // 1. JXA로 노트 추출
  let notes;
  try {
    notes = await extractNotes();
    console.log(`[MekiSync] ${notes.length}개 노트 추출 완료`);
  } catch (err) {
    console.error('[MekiSync] 노트 추출 실패:', err.message);
    console.error('Apple Notes 접근 권한을 확인하세요:');
    console.error('시스템 설정 > 개인 정보 보호 > 자동화 > Notes 허용');
    process.exit(1);
  }

  if (notes.length === 0) {
    console.log('[MekiSync] 추출할 노트가 없습니다.');
    process.exit(0);
  }

  // 2. 페이로드 구성
  const payload = {
    version: PROTOCOL_VERSION,
    source: 'apple_notes',
    notes,
    exportedAt: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify(payload);

  // 3. 일회성 HTTP 서버
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      // 브라우저가 열리면 — 데이터를 localStorage에 쓰고 meki로 리다이렉트
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildBridgePage(payloadJson, MEKI_IMPORT_URL, STORAGE_KEY));
    } else {
      res.writeHead(404);
      res.end();
    }

    // 요청 처리 후 서버 종료
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  });

  // 30초 타임아웃 — 브라우저가 열리지 않을 경우 자동 종료
  const timeout = setTimeout(() => {
    console.log('[MekiSync] 타임아웃 — 브라우저가 열리지 않았습니다.');
    server.close();
    process.exit(0);
  }, BRIDGE_TIMEOUT_MS);

  server.listen(PORT, '127.0.0.1', () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/`;
    console.log(`[MekiSync] 브라우저 열기: ${url}`);

    // 4. 기본 브라우저 오픈
    exec(`open "${url}"`);
    timeout.refresh(); // 타임아웃 리셋 (listen 이후 시작)
  });
}

function extractNotes() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'extract.js');
    execFile('osascript', ['-l', 'JavaScript', scriptPath], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error('노트 데이터 파싱 실패'));
      }
    });
  });
}

/**
 * localStorage에 데이터를 쓰고 meki로 리다이렉트하는 일회성 HTML 페이지
 */
function buildBridgePage(payloadJson, redirectUrl, storageKey) {
  // payloadJson을 HTML 안에 안전하게 삽입 (JSON 자체는 XSS-safe)
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
    <p>노트를 Meki로 전달하는 중...</p>
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
