/**
 * Apple Notes 추출기 — JXA (JavaScript for Automation)
 *
 * 실행: osascript -l JavaScript extract.js
 * 반환: JSON 문자열 (stdout)
 *
 * 권한: macOS 설정 > 개인 정보 보호 > 자동화에서
 *       터미널(또는 앱)의 "Notes" 접근 허용 필요
 */

/* global Application, ObjC */

function run() {
  ObjC.import('Foundation');

  const notes = Application('Notes');
  notes.includeStandardAdditions = true;

  const result = [];

  // 폴더별 순회 (기본 폴더 포함)
  const allFolders = notes.folders();
  for (const folder of allFolders) {
    const folderName = safeGet(() => folder.name(), '기본');
    const folderNotes = folder.notes();

    for (const note of folderNotes) {
      try {
        result.push({
          id: String(note.id()),
          title: safeGet(() => note.name(), '제목 없음'),
          body: safeGet(() => note.plaintext(), ''),
          source: 'apple_notes',
          folder: folderName,
          createdAt: safeDate(note.creationDate()),
          modifiedAt: safeDate(note.modificationDate()),
        });
      } catch (e) {
        // 잠긴 노트 등 — 건너뜀
      }
    }
  }

  return JSON.stringify(result);
}

function safeGet(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function safeDate(d) {
  try { return d.toISOString(); } catch { return new Date().toISOString(); }
}
