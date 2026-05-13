/**
 * MekiSync Daemon 설정 관리
 *
 * 설정 파일 위치:
 *   Mac:     ~/Library/Application Support/MekiSync/config.json
 *   Windows: %APPDATA%\MekiSync\config.json
 *
 * 저장 항목:
 *   - GitHub Personal Access Token (repo 권한)
 *   - 마지막 동기화 시각 (증분 감지용)
 *   - 폴링 간격 (기본 10분)
 *   - 동기화할 노트 소스 (apple | samsung | both)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_NAME = 'MekiSync';
const CONFIG_FILE = 'config.json';

function getConfigDir() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  return path.join(process.env.APPDATA || os.homedir(), APP_NAME);
}

const CONFIG_PATH = path.join(getConfigDir(), CONFIG_FILE);

const DEFAULTS = {
  githubToken: '',
  githubUsername: '',
  dataRepo: 'miki-data',
  pollIntervalMs: 10 * 60 * 1000, // 10분
  sources: ['apple'],              // 'apple' | 'samsung'
  samsungNotesDir: '',             // Samsung Notes 내보내기 폴더
  lastSyncAt: null,
  mekiUrl: 'https://app.meki.com',
};

function load() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(config) {
  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function update(partial) {
  const current = load();
  const updated = { ...current, ...partial };
  save(updated);
  return updated;
}

module.exports = { load, save, update, CONFIG_PATH };
