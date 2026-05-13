/**
 * Samsung Notes 추출기
 *
 * Samsung Notes는 .sdocx 파일로 내보내기 가능:
 *   Samsung Notes 앱 → 메모 선택 → 공유 → 파일로 저장 (.sdocx)
 *
 * 파서: twangodev/sdocx (https://github.com/twangodev/sdocx)
 * 설치: npm install sdocx
 */

const fs = require('fs');
const path = require('path');

/**
 * .sdocx 파일 목록에서 노트 추출
 * @param {string[]} filePaths - .sdocx 파일 경로 배열
 * @returns {Promise<Array>} BridgeNote 배열
 */
async function extractFromFiles(filePaths) {
  let parseSdocx;
  try {
    // sdocx npm 패키지 동적 로드 (선택적 의존성)
    ({ default: parseSdocx } = await import('sdocx'));
  } catch {
    throw new Error(
      'sdocx 패키지가 설치되지 않았습니다.\n' +
      '실행: npm install sdocx'
    );
  }

  const notes = [];
  for (const filePath of filePaths) {
    try {
      const buf = fs.readFileSync(filePath);
      const parsed = await parseSdocx(buf);

      const stat = fs.statSync(filePath);
      const baseName = path.basename(filePath, '.sdocx');

      notes.push({
        id: `samsung-${baseName}-${stat.mtimeMs}`,
        title: parsed.title || baseName,
        body: parsed.plainText || parsed.text || '',
        source: 'samsung_notes',
        folder: path.dirname(filePath),
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch (err) {
      console.warn(`[skip] ${filePath}: ${err.message}`);
    }
  }
  return notes;
}

/**
 * 디렉토리에서 모든 .sdocx 파일 재귀 탐색
 * @param {string} dir
 * @returns {string[]}
 */
function findSdocxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSdocxFiles(fullPath));
    } else if (entry.name.endsWith('.sdocx')) {
      results.push(fullPath);
    }
  }
  return results;
}

module.exports = { extractFromFiles, findSdocxFiles };
