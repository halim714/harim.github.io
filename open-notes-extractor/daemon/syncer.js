/**
 * MekiSync Daemon — 핵심 동기화 로직
 *
 * 역할: 신규/변경 노트를 miki-data/raw/notes/ 에 GitHub API로 저장
 * AI 컴파일은 브라우저(miki-editor)에서 처리 — 데몬은 raw 백업만 담당
 */

const { execFile } = require('child_process');
const path = require('path');
const https = require('https');

/**
 * Apple Notes에서 마지막 동기화 이후 변경된 노트 추출
 * @param {string|null} since - ISO 8601, null이면 전체
 * @returns {Promise<Array>} BridgeNote 배열
 */
async function extractAppleNotes(since) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../apple/extract.js');
    execFile('osascript', ['-l', 'JavaScript', scriptPath], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      try {
        let notes = JSON.parse(stdout.trim());
        if (since) {
          const sinceTs = new Date(since).getTime();
          notes = notes.filter(n => new Date(n.modifiedAt).getTime() > sinceTs);
        }
        resolve(notes);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Samsung Notes .sdocx 파일에서 변경된 노트 추출
 * @param {string} dir - 내보내기 폴더
 * @param {string|null} since
 * @returns {Promise<Array>}
 */
async function extractSamsungNotes(dir, since) {
  const { extractFromFiles, findSdocxFiles } = require('../samsung/extract');
  const files = findSdocxFiles(dir);
  const notes = await extractFromFiles(files);
  if (!since) return notes;
  const sinceTs = new Date(since).getTime();
  return notes.filter(n => new Date(n.modifiedAt).getTime() > sinceTs);
}

/**
 * miki-data/raw/notes/{YYYY-MM-DD}/{id}.md 형태로 GitHub에 저장
 * @param {Array} notes
 * @param {{ githubToken, githubUsername, dataRepo }} config
 * @returns {Promise<number>} 저장된 노트 수
 */
async function pushToGitHub(notes, config) {
  const { githubToken, githubUsername, dataRepo } = config;
  if (!githubToken || !githubUsername) throw new Error('GitHub 설정이 없습니다. mekisync setup을 실행하세요.');

  let pushed = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const note of notes) {
    const safeName = note.title.replace(/[^\w가-힣]/g, '_').slice(0, 60) || note.id;
    const filePath = `raw/notes/${today}/${safeName}.md`;
    const content = buildNoteMarkdown(note);

    try {
      await githubPut(githubToken, githubUsername, dataRepo, filePath, content,
        `sync: ${note.source} "${note.title}"`);
      pushed++;
    } catch (err) {
      console.warn(`[MekiSync] 저장 실패: ${note.title} — ${err.message}`);
    }
  }

  return pushed;
}

function buildNoteMarkdown(note) {
  return [
    `---`,
    `source: ${note.source}`,
    `folder: ${note.folder || ''}`,
    `original_id: ${note.id}`,
    `created_at: ${note.createdAt}`,
    `synced_at: ${new Date().toISOString()}`,
    `---`,
    ``,
    `# ${note.title}`,
    ``,
    note.body || '',
  ].join('\n');
}

function githubPut(token, owner, repo, filePath, content, message) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    const body = JSON.stringify({ message, content: encoded });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${filePath}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MekiSync-Daemon/1.0',
        'Accept': 'application/vnd.github+json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    // SHA 조회 후 업데이트 (파일이 이미 존재하면 필요)
    getFileSha(token, owner, repo, filePath).then(sha => {
      if (sha) {
        const bodyWithSha = JSON.stringify({ message, content: encoded, sha });
        options.headers['Content-Length'] = Buffer.byteLength(bodyWithSha);
        doRequest(options, bodyWithSha, resolve, reject);
      } else {
        doRequest(options, body, resolve, reject);
      }
    }).catch(() => doRequest(options, body, resolve, reject));
  });
}

function getFileSha(token, owner, repo, filePath) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${filePath}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'MekiSync-Daemon/1.0',
        'Accept': 'application/vnd.github+json',
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).sha || null); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function doRequest(options, body, resolve, reject) {
  const req = https.request(options, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(JSON.parse(data));
      } else {
        reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
      }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
}

module.exports = { extractAppleNotes, extractSamsungNotes, pushToGitHub };
