#!/usr/bin/env node
// validate-grill-cache.mjs — PreToolUse hook: SPEC 편집 전 grill-cache 검증
// Exit 0 = 허용 | Exit 2 = 차단

import { readFileSync, statSync, existsSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CACHE_DIR = resolve(REPO_ROOT, '.agents/grill-cache');

function die(code, ...lines) {
  if (lines.length) process.stderr.write(lines.join('\n') + '\n');
  process.exit(code);
}

function parseISO(str) {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// ── 1. stdin payload 파싱 ───────────────────────────────────────────────────
let payload;
try {
  const raw = readFileSync('/dev/stdin', 'utf8');
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // 파싱 실패 → 통과 (비-파일 작업)
}

const filePath = payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? '';
if (!filePath) process.exit(0);

// ── 2. SPEC 파일 여부 확인 (SPEC_*.md 아니면 즉시 통과) ────────────────────
const specBasename = basename(filePath);
if (!/^SPEC_.+\.md$/.test(specBasename)) process.exit(0);

// ── 이하: SPEC 파일 — 에러는 fail-closed (exit 2) ─────────────────────────

const DOMAIN = specBasename.replace(/\.md$/, ''); // SPEC_xss_security
const cacheFile = resolve(CACHE_DIR, `${DOMAIN}.json`);
const bypassFile = resolve(CACHE_DIR, `${DOMAIN}.bypass.json`);

// ── 3. bypass.json 확인 ────────────────────────────────────────────────────
if (existsSync(bypassFile)) {
  try {
    const bypass = JSON.parse(readFileSync(bypassFile, 'utf8'));
    const created = parseISO(bypass.created_at);
    const expiresMin = Number(bypass.expires_in_minutes ?? 15);
    if (created) {
      const elapsedMin = (Date.now() - created.getTime()) / 60000;
      if (elapsedMin < expiresMin) {
        process.stderr.write(
          `⚠️  [grill-cache] bypass 적용 중 (${Math.floor(elapsedMin)}/${expiresMin}분) — ${bypass.reason ?? '명시 없음'}\n`
        );
        process.exit(0);
      } else {
        process.stderr.write(
          `⏰ [grill-cache] bypass 만료됨 (${Math.floor(elapsedMin)}분 경과, 한도 ${expiresMin}분)\n`
        );
      }
    }
  } catch { /* bypass.json 파싱 실패 → 무시하고 정상 검증 */ }
}

// ── 4. cache 존재 확인 ─────────────────────────────────────────────────────
if (!existsSync(cacheFile)) {
  die(2,
    `❌ [grill-cache] ${specBasename} 편집 차단`,
    `   캐시가 없습니다: .agents/grill-cache/${DOMAIN}.json`,
    ``,
    `   먼저 /grill-with-docs ${DOMAIN} 를 실행하여 Step 1 코드 캐시를 생성하세요.`,
    ``,
    `   긴급 우회 (15분):`,
    `   echo '{"domain":"${DOMAIN}","reason":"<사유>","created_at":"${new Date().toISOString()}","expires_in_minutes":15}' > "${bypassFile}"`
  );
}

// ── 5. cache JSON 파싱 ─────────────────────────────────────────────────────
let cache;
try {
  cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
} catch (e) {
  die(2, `❌ [grill-cache] ${specBasename} 편집 차단 — 캐시 JSON 파싱 실패: ${e.message}`);
}

// ── 6. 스키마 검증 ─────────────────────────────────────────────────────────
const errors = [];

if (!cache.schema_version) errors.push('schema_version 필드 없음');

if (!cache.domain) {
  errors.push('domain 필드 없음');
} else if (cache.domain !== DOMAIN) {
  errors.push(`domain 불일치: cache='${cache.domain}' vs 기대='${DOMAIN}'`);
}

if (!cache.coverage) {
  errors.push('coverage 필드 없음');
} else {
  if (!Array.isArray(cache.coverage.files_read) || cache.coverage.files_read.length === 0)
    errors.push('coverage.files_read 비어있음 (최소 1개 필요)');
  if (!('unchecked_callers' in cache.coverage))
    errors.push('coverage.unchecked_callers 필드 없음');
}

const VALID_FACT_TYPES = new Set(['code_observation', 'invariant', 'constraint', 'gap']);
if (!Array.isArray(cache.facts) || cache.facts.length === 0) {
  errors.push('facts 배열 비어있음 (최소 1개 필요)');
} else {
  const invalid = cache.facts.filter(f => !VALID_FACT_TYPES.has(f.type)).map(f => f.type);
  if (invalid.length)
    errors.push(`facts[].type 유효하지 않은 값: ${invalid.slice(0, 3).join(', ')} (허용: code_observation|invariant|constraint|gap)`);
}

if (errors.length) {
  die(2,
    `❌ [grill-cache] ${specBasename} 편집 차단 — 캐시 스키마 오류:`,
    ...errors.map(e => `   • ${e}`)
  );
}

// ── 7. staleness + missing-file 검증 ──────────────────────────────────────
if (cache.generated_at && Array.isArray(cache.coverage?.files_read)) {
  const generatedAt = parseISO(cache.generated_at);
  if (generatedAt) {
    const allowMissing = cache.coverage.allow_missing_files === true;
    const missingAllowed = new Set((cache.coverage.missing_files ?? []).map(m => m.path));

    let maxMtime = 0;
    let staleFile = null;

    for (const relPath of cache.coverage.files_read) {
      const absPath = relPath.startsWith('/') ? relPath : resolve(REPO_ROOT, relPath);

      if (!existsSync(absPath)) {
        if (allowMissing && missingAllowed.has(relPath)) continue;
        die(2,
          `❌ [grill-cache] ${specBasename} 편집 차단 — evidence 파일 없음`,
          `   '${relPath}' 이 coverage.files_read에 있으나 파일이 존재하지 않습니다.`,
          `   Step 1을 다시 실행하거나, coverage.allow_missing_files + missing_files[]에 이유를 명시하세요.`
        );
      }

      const mtime = statSync(absPath).mtimeMs;
      if (mtime > maxMtime) { maxMtime = mtime; staleFile = relPath; }
    }

    if (maxMtime > generatedAt.getTime()) {
      die(2,
        `❌ [grill-cache] ${specBasename} 편집 차단 — 캐시가 오래됨`,
        `   '${staleFile}' 이 캐시 생성 이후 수정되었습니다.`,
        `   /grill-with-docs ${DOMAIN} Step 1을 다시 실행해 캐시를 갱신하세요.`
      );
    }
  }
}

// ── 8. 모든 검증 통과 ─────────────────────────────────────────────────────
const pct = cache.coverage?.percent ?? '?';
process.stderr.write(`✅ [grill-cache] ${DOMAIN} 캐시 유효 (coverage: ${pct}%)\n`);
process.exit(0);
