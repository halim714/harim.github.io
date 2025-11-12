const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Load environment variables - prefer server-local secrets
dotenv.config({ path: path.resolve(__dirname, '.server.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3003;

// Posts directory path (editor local)
const POSTS_DIR = path.join(__dirname, 'posts');
// Wiki paths (configurable via .env)
const WIKI_PATH = process.env.WIKI_PATH || path.resolve(__dirname, '../miki-wiki');
const WIKI_POSTS = process.env.WIKI_POSTS || '_posts';
const WIKI_HISTORY = process.env.WIKI_HISTORY || 'history';

// === Helper utilities ===
const LOCK_FILE = '.miki-lock';

function sanitizeForFileName(input) {
  return String(input || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function findWikiPostFileByDocId(docId) {
  const postsDir = path.join(WIKI_PATH, WIKI_POSTS);
  try {
    const files = await fs.readdir(postsDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      try {
        const raw = await fs.readFile(path.join(postsDir, file), 'utf8');
        const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
        if (match) {
          const meta = match[1];
          const idMatch = meta.match(/docId:\s*"([^"]+)"/);
          if (idMatch && idMatch[1] === docId) {
            return file; // return filename under _posts
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function acquireWikiLock() {
  const lockPath = path.join(WIKI_PATH, LOCK_FILE);
  try {
    const fh = await fs.open(lockPath, 'wx');
    await fh.write(String(Date.now()));
    await fh.close();
    return true;
  } catch (e) {
    // if stale (>5 minutes), remove then retry once
    try {
      const stat = await fs.stat(lockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > 5 * 60 * 1000) {
        await fs.unlink(lockPath);
        const fh2 = await fs.open(lockPath, 'wx');
        await fh2.write(String(Date.now()));
        await fh2.close();
        return true;
      }
    } catch {}
    throw new Error('Another publish is in progress');
  }
}

async function releaseWikiLock() {
  try { await fs.unlink(path.join(WIKI_PATH, LOCK_FILE)); } catch {}
}

// ===== Setup helpers =====
function maskSecret(str) {
  if (!str) return str;
  const s = String(str);
  if (s.length <= 6) return '***';
  return s.slice(0, 2) + '***' + s.slice(-2);
}

async function writeEnvValues(kv) {
  // Persist to server-local .server.env; also update process.env live
  try {
    const envPath = path.resolve(__dirname, '.server.env');
    let existing = '';
    try { existing = await fs.readFile(envPath, 'utf8'); } catch {}
    const lines = existing.split('\n');
    const map = new Map();
    for (const line of lines) {
      const m = line.match(/^([^#=\s]+)=(.*)$/);
      if (m) map.set(m[1], m[2]);
    }
    for (const [k, v] of Object.entries(kv)) {
      if (v === undefined || v === null) continue;
      map.set(k, String(v));
      process.env[k] = String(v);
    }
    const out = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('\n');
    await fs.writeFile(envPath, out + '\n', 'utf8');
    return true;
  } catch (e) {
    console.error('writeEnvValues failed:', e.message || e);
    return false;
  }
}

async function ensureGitRemoteConfigured(owner, repo) {
  try {
    const wikiCwd = WIKI_PATH;
    let remotes = '';
    try {
      const { stdout } = await execAsync('git remote -v', { cwd: wikiCwd, windowsHide: true });
      remotes = stdout || '';
    } catch {}
    const httpsRemote = `https://github.com/${owner}/${repo}.git`;
    if (!/\sorigin\s/.test(remotes)) {
      await execAsync(`git remote add origin "${httpsRemote}"`, { cwd: wikiCwd, windowsHide: true });
    } else if (!remotes.includes(httpsRemote)) {
      // reset to expected remote
      try { await execAsync('git remote remove origin', { cwd: wikiCwd, windowsHide: true }); } catch {}
      await execAsync(`git remote add origin "${httpsRemote}"`, { cwd: wikiCwd, windowsHide: true });
    }
    return true;
  } catch (e) {
    console.warn('ensureGitRemoteConfigured failed:', e.message || e);
    return false;
  }
}

async function updateJekyllConfig(pageType, owner, repo) {
  try {
    const cfgPath = path.join(WIKI_PATH, '_config.yml');
    let cfg = '';
    try { cfg = await fs.readFile(cfgPath, 'utf8'); } catch {}
    const isUser = pageType === 'user' || (repo && repo.toLowerCase() === `${owner.toLowerCase()}.github.io`);
    const url = `https://${owner}.github.io`;
    const baseurl = isUser ? '' : `/${repo}`;
    const ensureLine = (text, key, value) => {
      const re = new RegExp(`^${key}:\\s*.*$`, 'm');
      if (re.test(text)) return text.replace(re, `${key}: "${value}"`);
      const sep = text && text.trim().length ? '\n' : '';
      return text + `${sep}${key}: "${value}"\n`;
    };
    let next = cfg || '';
    next = ensureLine(next, 'url', url);
    next = ensureLine(next, 'baseurl', baseurl);
    next = ensureLine(next, 'permalink', '/doc/:title/');
    // minimal stability
    next = ensureLine(next, 'timezone', 'Asia/Seoul');
    await fs.mkdir(path.dirname(cfgPath), { recursive: true });
    await fs.writeFile(cfgPath, next, 'utf8');
    return { url, baseurl };
  } catch (e) {
    console.error('updateJekyllConfig failed:', e.message || e);
    return null;
  }
}

// Initialize posts directory
async function initPostsDirectory() {
  try {
    await fs.mkdir(POSTS_DIR, { recursive: true });
    console.log('Posts directory initialized:', POSTS_DIR);
  } catch (error) {
    console.error('Posts directory initialization error:', error);
  }
}

// Call initialization function on startup
initPostsDirectory();

// CORS configuration - more clearly configured
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 
           'http://localhost:3009', 'http://localhost:3010', 'http://localhost:3011', 'http://localhost:3012',
           'http://localhost:3013', 'http://localhost:3014', 'http://localhost:3015', 'http://localhost:3016',
           'http://localhost:3017', 'http://localhost:3018', 'http://localhost:3019', 'http://localhost:3020'],
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request body parsing configuration
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware for all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Server status check endpoint
app.get('/', (req, res) => {
  res.send('Miki Editor backend server is running.');
});

// API status check endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== Setup API =====
// Verify token/repo access and git status
app.post('/api/setup/verify', async (req, res) => {
  try {
    const { token, owner: o, repo: r } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: 'MISSING_TOKEN' });

    // 1) Owner resolve
    let owner = o;
    try {
      const me = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${token}` }, timeout: 5000
      });
      owner = owner || me?.data?.login;
      if (!owner) throw new Error('GH_USER_FAIL');
    } catch (e) {
      return res.status(401).json({ ok: false, error: 'TOKEN_INVALID' });
    }

    // 2) Repo resolve
    let repo = r || (process.env.GITHUB_REPO?.split('/')?.[1] || '');
    if (!repo) {
      try {
        const list = await axios.get(`https://api.github.com/users/${owner}/repos?per_page=100&sort=updated`, {
          headers: { Authorization: `token ${token}` }, timeout: 7000
        });
        const userRepo = `${owner}.github.io`;
        const picked = list.data.find(v => v.name.toLowerCase() === userRepo.toLowerCase()) || list.data[0];
        repo = picked?.name;
      } catch {}
    }
    if (!repo) return res.status(404).json({ ok: false, error: 'REPO_NOT_RESOLVED' });

    // 3) Branch + pageType
    let pageType = 'project';
    let branch = 'main';
    try {
      const meta = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `token ${token}` }, timeout: 5000
      });
      branch = meta?.data?.default_branch || 'main';
      pageType = repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? 'user' : 'project';
    } catch {}

    const base = await updateJekyllConfig(pageType, owner, repo);
    const remoteOk = await ensureGitRemoteConfigured(owner, repo);

    return res.json({ ok: true, owner, repo, pageType, branch, base, remoteOk });
  } catch (e) {
    console.error('setup/verify failed:', e.message || e);
    res.status(500).json({ ok: false, error: 'VERIFY_FAILED' });
  }
});

// Save token & repo config securely (server-local)
app.post('/api/setup/save-token', async (req, res) => {
  try {
    const { token, owner, repo, pageType, branch } = req.body || {};
    if (!token || !owner || !repo) return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });

    const envOk = await writeEnvValues({
      GITHUB_TOKEN: token,
      GITHUB_USER: owner,
      GITHUB_REPO: `${owner}/${repo}`,
      WIKI_BRANCH: branch || (process.env.WIKI_BRANCH || '')
    });

    const cfg = await updateJekyllConfig(pageType, owner, repo);
    const remoteOk = await ensureGitRemoteConfigured(owner, repo);

    res.json({ ok: true, saved: envOk, base: cfg || null, remoteOk, masked: { token: maskSecret(token) } });
  } catch (e) {
    console.error('setup/save-token failed:', e.message || e);
    res.status(500).json({ ok: false, error: 'SAVE_FAILED' });
  }
});

// Check Claude API key
const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY || '';
console.log('API key load status:', CLAUDE_API_KEY ? 'API key loaded successfully' : 'API key not loaded');

// Claude API proxy endpoint
app.post('/api/claude', async (req, res) => {
  try {
    console.log('API request received:', req.path);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!CLAUDE_API_KEY) {
      return res.status(400).json({ error: 'Claude API key not set' });
    }

    // Log request data for model name verification
    console.log('Request model:', req.body.model);
    
    const apiUrl = 'https://api.anthropic.com/v1/messages';
    console.log('Anthropic API request URL:', apiUrl);

    const response = await axios.post(apiUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01' // Latest version
      }
    });

    console.log('Claude API response success:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Claude API error:', error.response ? error.response.data : error.message);
    console.error('Error details:', JSON.stringify(error.response?.data || error.message, null, 2));
    console.error('Request data:', JSON.stringify(req.body, null, 2));
    
    res.status(error.response ? error.response.status : 500).json({
      error: error.response ? error.response.data : error.message
    });
  }
});

// ==== Posts management API endpoints ====

// Preflight check for publish: filename conflicts and link validation
app.post('/api/publish/preflight', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    const srcPath = path.join(POSTS_DIR, `${id}.md`);
    const fullContent = await fs.readFile(srcPath, 'utf8');
    // strip front matter
    let contentOnly = fullContent;
    let title = 'New memo';
    const fmMatch = fullContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const metaRaw = fmMatch[1];
      contentOnly = fmMatch[2];
      const titleMatch = metaRaw.match(/title:\s*"([^"]+)"/);
      if (titleMatch) title = titleMatch[1];
    } else {
      // fallback to server extract function
      title = (contentOnly.match(/^#\s+(.+)$/m)?.[1] || 'New memo').trim();
    }

    const datePrefix = new Date().toISOString().slice(0, 10);
    const safeTitle = sanitizeForFileName(title);

    // docId 기반으로 업데이트 대상 탐색
    const existingFile = await findWikiPostFileByDocId(id);
    const createFileName = `${datePrefix}-${safeTitle || 'post'}.md`;
    const destLatest = path.join(WIKI_PATH, WIKI_POSTS, createFileName);

    // Link validation (basic)
    const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g; // markdown links
    const links = [];
    let m;
    while ((m = linkRegex.exec(contentOnly)) !== null) {
      links.push(m[1]);
    }
    const internalDocIds = [];
    const externalUrls = [];
    for (const href of links) {
      if (href.startsWith('/doc/')) {
        const docId = href.substring(5).replace(/\/+$/, '');
        if (docId) internalDocIds.push(docId);
      } else if (/^https?:\/\//i.test(href)) {
        externalUrls.push(href);
      }
    }

    // Check internal doc existence in editor posts
    const missingIds = [];
    for (const refId of Array.from(new Set(internalDocIds))) {
      try {
        await fs.access(path.join(POSTS_DIR, `${refId}.md`));
      } catch {
        missingIds.push(refId);
      }
    }

    // Optional: external URL HEAD check (limit to 5)
    const extOk = [];
    const extFail = [];
    const toCheck = externalUrls.slice(0, 5);
    for (const url of toCheck) {
      try {
        await axios.head(url, { timeout: 2000, maxRedirects: 2 });
        extOk.push(url);
      } catch {
        extFail.push(url);
      }
    }
    const extUnchecked = externalUrls.slice(5);

    const result = {
      // 내부 문서 누락은 경고로만 처리, 외부 링크 오류만 차단
      ok: extFail.length === 0,
      action: existingFile ? 'update' : 'create',
      targetPath: existingFile ? path.join('/', WIKI_POSTS, existingFile) : path.join('/', WIKI_POSTS, createFileName),
      linkReport: {
        internal: { checked: internalDocIds.length, missingIds },
        external: { ok: extOk, failed: extFail, unchecked: extUnchecked }
      }
    };
    res.json(result);
  } catch (error) {
    console.error('Preflight error:', error);
    res.status(500).json({ error: 'Preflight failed' });
  }
});
// Publish to miki-wiki: copy current post to _posts and history, then git commit/push
app.post('/api/publish', async (req, res) => {
  try {
    const { id, action, targetPath } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    const srcPath = path.join(POSTS_DIR, `${id}.md`);
    // Read source
    const fullContent = await fs.readFile(srcPath, 'utf8');
    // Extract front matter and content
    let content = fullContent;
    let meta = {};
    const fmMatch = fullContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const metaRaw = fmMatch[1];
      content = fmMatch[2];
      const titleMatch = metaRaw.match(/title:\s*"([^"]+)"/);
      const titleModeMatch = metaRaw.match(/titleMode:\s*"([^"]+)"/);
      const createdAtMatch = metaRaw.match(/createdAt:\s*"([^"]+)"/);
      const updatedAtMatch = metaRaw.match(/updatedAt:\s*"([^"]+)"/);
      meta.title = titleMatch ? titleMatch[1] : 'New memo';
      meta.titleMode = titleModeMatch ? titleModeMatch[1] : 'auto';
      meta.createdAt = createdAtMatch ? createdAtMatch[1] : new Date().toISOString();
      meta.updatedAt = new Date().toISOString();
    } else {
      meta = { title: 'New memo', titleMode: 'auto', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }

    // Determine target file (update existing by docId or create new)
    const datePrefix = new Date().toISOString().slice(0, 10);
    const safeTitle = sanitizeForFileName(meta.title);
    let postFileName = `${datePrefix}-${safeTitle || 'post'}.md`;
    if (action === 'update' && targetPath) {
      // targetPath like '/_posts/2025-08-29-xxx.md'
      postFileName = path.basename(targetPath);
    } else if (action === 'update' && !targetPath) {
      const existing = await findWikiPostFileByDocId(id);
      if (existing) postFileName = existing;
    }

    // Ensure wiki directories exist
    const wikiPostsPath = path.join(WIKI_PATH, WIKI_POSTS);
    const wikiHistoryBase = path.join(WIKI_PATH, WIKI_HISTORY, id);
    await fs.mkdir(wikiPostsPath, { recursive: true });
    await fs.mkdir(wikiHistoryBase, { recursive: true });

    const nowIso = new Date().toISOString();
    const frontMatter = `---\n` +
      `docId: "${id}"\n` +
      `title: "${meta.title}"\n` +
      `titleMode: "${meta.titleMode}"\n` +
      `createdAt: "${meta.createdAt}"\n` +
      `updatedAt: "${nowIso}"\n` +
      `permalink: "/doc/${id}/"\n` +
      `---\n`;
    const finalContent = frontMatter + content;

    // Write latest to _posts (overwrite if exists)
    const destLatest = path.join(wikiPostsPath, postFileName);
    await fs.writeFile(destLatest, finalContent, 'utf8');

    // Write snapshot to history
    const ts = nowIso.replace(/[:.]/g, '').replace('T', 'T').slice(0, 15);
    const historyFile = path.join(wikiHistoryBase, `${ts}.md`);
    await fs.writeFile(historyFile, finalContent, 'utf8');

    // ==== Update history JSON indexes ====
    // Per-doc index.json
    try {
      const perDocIndexPath = path.join(wikiHistoryBase, 'index.json');
      // list snapshots
      const entries = await fs.readdir(wikiHistoryBase);
      const snapshots = entries
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const base = f.replace(/\.md$/, '');
          return {
            path: `/history/${id}/${base}.html`,
            markdownPath: `/history/${id}/${base}.md`,
            timestamp: base,
          };
        })
        // newest first
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

      const perDocIndex = {
        id,
        title: meta.title,
        latest: snapshots[0] || null,
        snapshots,
      };
      await fs.writeFile(perDocIndexPath, JSON.stringify(perDocIndex, null, 2), 'utf8');
    } catch (e) {
      console.warn('Per-doc history index update failed:', e.message || e);
    }

    // Global history index.json
    try {
      const historyRoot = path.join(WIKI_PATH, WIKI_HISTORY);
      await fs.mkdir(historyRoot, { recursive: true });
      const dirs = await fs.readdir(historyRoot, { withFileTypes: true });
      const docDirs = dirs.filter((d) => d.isDirectory());
      const docs = [];
      for (const dirent of docDirs) {
        const docId = dirent.name;
        const idxPath = path.join(historyRoot, docId, 'index.json');
        try {
          const raw = await fs.readFile(idxPath, 'utf8');
          const json = JSON.parse(raw);
          docs.push({
            id: json.id || docId,
            title: json.title || 'Untitled',
            latest: json.latest || null,
            count: Array.isArray(json.snapshots) ? json.snapshots.length : 0,
            path: `/history/${docId}/index.json`,
          });
        } catch {}
      }
      // newest first by latest timestamp
      docs.sort((a, b) => {
        const at = a.latest?.timestamp || '';
        const bt = b.latest?.timestamp || '';
        return at < bt ? 1 : -1;
      });
      const globalIndex = { generatedAt: nowIso, docs };
      const globalIndexPath = path.join(historyRoot, 'index.json');
      await fs.writeFile(globalIndexPath, JSON.stringify(globalIndex, null, 2), 'utf8');
    } catch (e) {
      console.warn('Global history index update failed:', e.message || e);
    }

    // Git commit and push (token-aware, safe logging, cross-platform friendly)
    try {
      await acquireWikiLock();
      const wikiCwd = WIKI_PATH;

      // 1) Stage changes
      await execAsync('git add .', { cwd: wikiCwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });

      // 2) Commit only if there are staged changes
      let stagedList = '';
      try {
        const { stdout } = await execAsync('git diff --cached --name-only', { cwd: wikiCwd, windowsHide: true });
        stagedList = stdout || '';
      } catch {
        stagedList = '';
      }

      if (stagedList.trim().length > 0) {
        const authorName = process.env.GIT_AUTHOR_NAME || 'Miki Editor';
        const authorEmail = process.env.GIT_AUTHOR_EMAIL || 'miki@example.com';
        await execAsync(
          `git -c user.name="${authorName}" -c user.email="${authorEmail}" commit -m "publish(${id}): ${safeTitle} @ ${nowIso}"`,
          { cwd: wikiCwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
        );
      }

      // 3) Determine branch
      let branch = (process.env.WIKI_BRANCH || '').trim();
      if (!branch) {
        try {
          const { stdout } = await execAsync('git symbolic-ref --short HEAD', { cwd: wikiCwd, windowsHide: true });
          branch = (stdout || '').trim() || 'main';
        } catch {
          branch = 'main';
        }
      }

      // 4) Push (use token URL if provided)
      const hasTokenAndRepo = !!process.env.GITHUB_TOKEN && !!process.env.GITHUB_REPO;
      if (hasTokenAndRepo) {
        const safeUser = encodeURIComponent(process.env.GITHUB_USER || 'oauth2');
        const safeToken = encodeURIComponent(process.env.GITHUB_TOKEN);
        const repo = process.env.GITHUB_REPO; // owner/repo
        const pushUrl = `https://${safeUser}:${safeToken}@github.com/${repo}.git`;
        await execAsync(`git push "${pushUrl}" HEAD:${branch}`, { cwd: wikiCwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
      } else {
        await execAsync(`git push origin HEAD:${branch}`, { cwd: wikiCwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
      }

      await releaseWikiLock();
      res.json({ message: '배포 완료: 위키에 반영되고 Git에 푸시되었습니다.' });
    } catch (e) {
      // 민감정보 노출 방지: 원문 커맨드/토큰/URL 출력 금지
      console.error('Git push failed');
      await releaseWikiLock();
      return res.status(200).json({
        message: '파일 동기화 완료. Git 푸시는 실패했을 수 있습니다. 수동으로 확인하세요.',
        details: (e && (e.stderr || e.message)) ? String(e.stderr || e.message).slice(0, 4000) : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Publish failed' });
  }
});

// Get post list
app.get('/api/posts', async (req, res) => {
  try {
    const files = await fs.readdir(POSTS_DIR);
    const postList = [];
    
    // Title extraction function (same as client)
    const extractTitleFromContent = (content) => {
      // 🎯 Log optimization: Only print important information
      if (!content || content.trim() === '') {
        return 'New memo';
      }
      
      // Server and client same logic: First search for # header
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
      
      // If no # header, use first line (50 character limit)
      const lines = content.split('\n');
      const firstLine = lines[0]?.trim() || '';
      
      if (firstLine === '') {
        return 'New memo';
      }
      
      // Remove markdown formatting and limit to 50 characters
      const cleanTitle = firstLine
        .replace(/^#+\s*/, '') // Remove header marker
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1') // Remove inline code
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove link
        .trim()
        .slice(0, 50); // Limit to 50 characters
      
      return cleanTitle || 'New memo';
    };
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(POSTS_DIR, file);
        const stats = await fs.stat(filePath);
        const fullContent = await fs.readFile(filePath, 'utf8');
        
        // 🎯 Front Matter parsing for title extraction
        let title = null;
        let titleMode = 'auto';
        let content = fullContent;
        
        const frontMatterMatch = fullContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (frontMatterMatch) {
          const metaData = frontMatterMatch[1];
          content = frontMatterMatch[2];
          
          const titleMatch = metaData.match(/title:\s*"([^"]+)"/);
          const titleModeMatch = metaData.match(/titleMode:\s*"([^"]+)"/);
          
          if (titleMatch) title = titleMatch[1];
          if (titleModeMatch) titleMode = titleModeMatch[1];
        }
        
        // Front Matter not found, old file processing (backward compatibility)
        if (!title) {
          title = extractTitleFromContent(content);
          titleMode = 'auto';
        }
        
        postList.push({
          id: file.replace('.md', ''),
          title: title,
          titleMode: titleMode,
          filename: file,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
          size: stats.size,
          preview: content.substring(0, 150) + (content.length > 150 ? '...' : '')
        });
      }
    }
    
    // Sort from latest post
    postList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    res.json(postList);
  } catch (error) {
    console.error('Post list retrieval error:', error);
    res.status(500).json({ error: 'Error retrieving post list' });
  }
});

// Get post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(POSTS_DIR, `${id}.md`);
    
    const fullContent = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    
    // 🎯 Front Matter parsing
    let title = null;
    let titleMode = 'auto';
    let content = fullContent;
    let createdAt = stats.birthtime;
    let updatedAt = stats.mtime;
    
    const frontMatterMatch = fullContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontMatterMatch) {
      const metaData = frontMatterMatch[1];
      content = frontMatterMatch[2];
      
      // Metadata parsing
      const titleMatch = metaData.match(/title:\s*"([^"]+)"/);
      const titleModeMatch = metaData.match(/titleMode:\s*"([^"]+)"/);
      const createdAtMatch = metaData.match(/createdAt:\s*"([^"]+)"/);
      const updatedAtMatch = metaData.match(/updatedAt:\s*"([^"]+)"/);
      
      if (titleMatch) title = titleMatch[1];
      if (titleModeMatch) titleMode = titleModeMatch[1];
      if (createdAtMatch) createdAt = new Date(createdAtMatch[1]);
      if (updatedAtMatch) updatedAt = new Date(updatedAtMatch[1]);
    }
    
    // Front Matter not found, old file processing (backward compatibility)
    if (!title) {
      // Client and server same title extraction logic
      const extractTitleFromContent = (content) => {
        if (!content || content.trim() === '') return 'New memo';
        
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) return titleMatch[1].trim();
        
        const lines = content.split('\n');
        const firstLine = lines[0]?.trim() || '';
        if (firstLine === '') return 'New memo';
        
        return firstLine
          .replace(/^#+\s*/, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .trim()
          .slice(0, 50) || 'New memo';
      };
      
      title = extractTitleFromContent(content);
      titleMode = 'auto';
    }
    
    console.log(`📖 Document loaded: ${id} | Title: ${title} | Mode: ${titleMode}`);
    
    res.json({
      id,
      title,
      titleMode,
      content,
      updatedAt,
      createdAt
    });
  } catch (error) {
    console.error(`Post retrieval error (ID: ${req.params.id}):`, error);
    res.status(404).json({ error: 'Post not found' });
  }
});

// Save post
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, titleMode = 'manual' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Generate ID for file name (based on title)
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 
      `post-${Date.now()}`;
    
    const filePath = path.join(POSTS_DIR, `${id}.md`);
    
    // 🎯 Front Matter format for file creation
    const now = new Date().toISOString();
    const frontMatter = `---
docId: "${id}"
title: "${title}"
titleMode: "${titleMode}"
createdAt: "${now}"
updatedAt: "${now}"
permalink: "/doc/${id}/"
---
`;
    
    const fullContent = frontMatter + content;
    
    // Check if file already exists
    try {
      await fs.access(filePath);
      // If exists, create new ID with timestamp
      const newId = `${id}-${Date.now()}`;
      const newFilePath = path.join(POSTS_DIR, `${newId}.md`);
      await fs.writeFile(newFilePath, fullContent, 'utf8');
      
      console.log(`✅ New document created: ${newId} | Title: ${title} | Mode: ${titleMode}`);
      res.status(201).json({ id: newId, title, titleMode, success: true });
    } catch (accessError) {
      // If not exists, save directly
      await fs.writeFile(filePath, fullContent, 'utf8');
      
      console.log(`✅ New document created: ${id} | Title: ${title} | Mode: ${titleMode}`);
      res.status(201).json({ id, title, titleMode, success: true });
    }
  } catch (error) {
    console.error('Post saving error:', error);
    res.status(500).json({ error: 'Error saving post' });
  }
});

// Update post
app.put('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content = '', title, titleMode = 'auto' } = req.body;
    
    console.log(`🔍 [PUT-API] Request received: ${id}`);
    console.log(`📋 [PUT-API] Request data:`, {
      id,
      title,
      titleMode,
      contentLength: content?.length || 0,
      hasTitle: !!title,
      hasTitleMode: !!titleMode
    });
    
    // null or undefined check only, empty string is valid content
    if (content === null || content === undefined) {
      console.log(`❌ [PUT-API] Content validation failed: ${id}`);
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const filePath = path.join(POSTS_DIR, `${id}.md`);
    console.log(`📁 [PUT-API] File path: ${filePath}`);
    
    // 🎯 Metadata extraction function
    const extractTitleFromContent = (content) => {
      if (!content || content.trim() === '') return 'New memo';
      
      // First search for # header
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) return titleMatch[1].trim();
      
      // If no # header, use first line (50 character limit)
      const lines = content.split('\n');
      const firstLine = lines[0]?.trim() || '';
      if (firstLine === '') return 'New memo';
      
      return firstLine
        .replace(/^#+\s*/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .trim()
        .slice(0, 50) || 'New memo';
    };
    
    // 🎯 Title decision logic
    let finalTitle = title;
    let finalTitleMode = titleMode;
    
    if (!title || title.trim() === '') {
      // If no title, auto extract
      finalTitle = extractTitleFromContent(content);
      finalTitleMode = 'auto';
      console.log(`🤖 [PUT-API] Auto title extraction: "${finalTitle}"`);
    } else {
      // If title exists, use user title
      finalTitleMode = titleMode || 'manual';
      console.log(`👤 [PUT-API] User title used: "${finalTitle}" (Mode: ${finalTitleMode})`);
    }
    
    // 🎯 Front Matter format for file creation
    const now = new Date().toISOString();
    let existingCreatedAt = now;
    
    // Existing file, keep createdAt
    try {
      const existingContent = await fs.readFile(filePath, 'utf8');
      console.log(`📖 [PUT-API] Existing file found: ${id}`);
      
      const frontMatterMatch = existingContent.match(/^---\n([\s\S]*?)\n---\n/);
      if (frontMatterMatch) {
        const existingMeta = frontMatterMatch[1];
        const createdAtMatch = existingMeta.match(/createdAt:\s*"([^"]+)"/);
        if (createdAtMatch) {
          existingCreatedAt = createdAtMatch[1];
          console.log(`📅 [PUT-API] Existing createdAt kept: ${existingCreatedAt}`);
        }
      }
    } catch (error) {
      // If no file, create new
      console.log(`📝 [PUT-API] New file created: ${id}`);
    }
    
    const frontMatter = `---
docId: "${id}"
title: "${finalTitle}"
titleMode: "${finalTitleMode}"
createdAt: "${existingCreatedAt}"
updatedAt: "${now}"
permalink: "/doc/${id}/"
---
`;
    
    const fullContent = frontMatter + content;
    
    console.log(`💾 [PUT-API] Front Matter created:`, {
      title: finalTitle,
      titleMode: finalTitleMode,
      createdAt: existingCreatedAt,
      updatedAt: now,
      frontMatterLength: frontMatter.length,
      totalContentLength: fullContent.length
    });
    
    await fs.writeFile(filePath, fullContent, 'utf8');
    
    console.log(`✅ [PUT-API] Document saved: ${id} | Title: ${finalTitle} | Mode: ${finalTitleMode}`);
    console.log(`📁 [PUT-API] Saved file size: ${fullContent.length} bytes`);
    
    res.json({ 
      id, 
      title: finalTitle,
      titleMode: finalTitleMode,
      success: true 
    });
  } catch (error) {
    console.error(`❌ [PUT-API] Post update error (ID: ${req.params.id}):`, error);
    console.error(`🔍 [PUT-API] Error details:`, {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({ error: 'Error updating post' });
  }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(POSTS_DIR, `${id}.md`);
    
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    console.error(`Post deletion error (ID: ${req.params.id}):`, error);
    res.status(500).json({ error: 'Error deleting post' });
  }
});

// Delete wiki post by docId (keeps history)
app.delete('/api/wiki/doc/:id', async (req, res) => {
  const { id } = req.params || {};
  if (!id) return res.status(400).json({ error: 'Missing document id' });
  try {
    const file = await findWikiPostFileByDocId(id);
    if (!file) return res.json({ success: true, message: 'No wiki post for this docId' });
    const target = path.join(WIKI_PATH, WIKI_POSTS, file);
    await fs.unlink(target);

    try {
      await acquireWikiLock();
      await execAsync('git add .', { cwd: WIKI_PATH });
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: WIKI_PATH });
      if ((stdout || '').trim()) {
        await execAsync('git -c user.name="Miki Editor" -c user.email="miki@example.com" commit -m "remove(doc): ' + id + '"', { cwd: WIKI_PATH });
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
          const pushUrl = `https://${encodeURIComponent(process.env.GITHUB_USER || 'oauth2')}:${encodeURIComponent(process.env.GITHUB_TOKEN)}@github.com/${process.env.GITHUB_REPO}.git`;
          let branch = (process.env.WIKI_BRANCH || 'main');
          await execAsync(`git push "${pushUrl}" HEAD:${branch}`, { cwd: WIKI_PATH });
        } else {
          await execAsync('git push', { cwd: WIKI_PATH });
        }
      }
      await releaseWikiLock();
    } catch (e) {
      await releaseWikiLock();
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Wiki deletion failed:', e.message || e);
    res.status(500).json({ error: 'Wiki deletion failed' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`API endpoint: http://localhost:${port}/api/claude`);
  console.log(`Posts management API: http://localhost:${port}/api/posts`);
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`API 엔드포인트: http://localhost:${port}/api/claude`);
  console.log(`글 관리 API: http://localhost:${port}/api/posts`);
}); 