/**
 * Local App Bridge 프로토콜 — Apple/Samsung 공통
 *
 * 흐름:
 * 1. 추출기가 노트 읽기
 * 2. bridge-server.js가 localhost:{port}에서 HTTP 서버 시작
 * 3. 브라우저를 http://localhost:{port}/ 로 자동 오픈
 * 4. 해당 페이지가 노트 데이터를 localStorage에 임시 저장
 * 5. 브라우저를 https://app.meki.com/import-bridge 로 리다이렉트
 * 6. miki-editor가 localStorage에서 읽어 GitHub에 저장
 * 7. 서버 자동 종료
 */

/**
 * @typedef {Object} BridgeNote
 * @property {string} id          - 원본 노트 고유 ID
 * @property {string} title       - 제목
 * @property {string} body        - 본문 (plain text)
 * @property {string} source      - 'apple_notes' | 'samsung_notes'
 * @property {string} folder      - 원본 폴더/카테고리
 * @property {string} createdAt   - ISO 8601
 * @property {string} modifiedAt  - ISO 8601
 */

/**
 * @typedef {Object} BridgePayload
 * @property {string}       version     - 프로토콜 버전
 * @property {string}       source      - 'apple_notes' | 'samsung_notes'
 * @property {BridgeNote[]} notes       - 추출된 노트 배열
 * @property {string}       exportedAt  - ISO 8601
 */

const PROTOCOL_VERSION = '1.0';
const STORAGE_KEY = 'meki_bridge_import';
const BRIDGE_TIMEOUT_MS = 30_000; // 서버 30초 타임아웃 후 자동 종료

module.exports = { PROTOCOL_VERSION, STORAGE_KEY, BRIDGE_TIMEOUT_MS };
