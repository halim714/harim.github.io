#!/usr/bin/env node
/**
 * MekiSync Daemon — 메인 엔트리포인트
 *
 * 사용법:
 *   node index.js            # 포그라운드 실행 (디버그)
 *   node index.js setup      # 초기 설정 (토큰, 폴링 간격 등)
 *   node index.js sync-now   # 즉시 1회 동기화 후 종료
 *   node index.js install    # launchd(Mac) / 작업 스케줄러(Win) 자동 시작 등록
 *   node index.js uninstall  # 자동 시작 해제
 *
 * 메뉴바/트레이는 menubar 패키지가 설치된 경우만 활성화
 * (없으면 폴링만 동작)
 */

const config = require('./config');
const { extractAppleNotes, extractSamsungNotes, pushToGitHub } = require('./syncer');

const [, , cmd] = process.argv;

async function main() {
  switch (cmd) {
    case 'setup': return runSetup();
    case 'sync-now': return runSyncOnce();
    case 'install': return runInstall();
    case 'uninstall': return runUninstall();
    default: return runDaemon();
  }
}

// ── 설정 마법사 ────────────────────────────────────────────────────────────

async function runSetup() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));

  console.log('\n🔧 MekiSync Daemon 초기 설정\n');

  const token = await ask('GitHub Personal Access Token (repo 권한 필요): ');
  const username = await ask('GitHub 사용자명: ');
  const intervalMin = await ask('폴링 간격 (분, 기본 10): ') || '10';
  const sourcesStr = await ask('동기화 소스 (apple / samsung / both, 기본 apple): ') || 'apple';

  let samsungDir = '';
  if (sourcesStr.includes('samsung') || sourcesStr === 'both') {
    samsungDir = await ask('Samsung Notes 내보내기 폴더 경로: ');
  }

  const sources = sourcesStr === 'both' ? ['apple', 'samsung']
    : sourcesStr === 'samsung' ? ['samsung'] : ['apple'];

  config.update({
    githubToken: token.trim(),
    githubUsername: username.trim(),
    pollIntervalMs: parseInt(intervalMin) * 60 * 1000,
    sources,
    samsungNotesDir: samsungDir.trim(),
  });

  rl.close();
  console.log(`\n✅ 설정 저장 완료: ${config.CONFIG_PATH}`);
  console.log('   node index.js install  — 자동 시작 등록');
  console.log('   node index.js sync-now — 지금 바로 동기화 테스트');
}

// ── 즉시 동기화 ────────────────────────────────────────────────────────────

async function runSyncOnce() {
  const cfg = config.load();
  if (!cfg.githubToken) {
    console.error('❌ 설정이 없습니다. node index.js setup 을 먼저 실행하세요.');
    process.exit(1);
  }
  console.log('[MekiSync] 동기화 시작...');
  const count = await syncCycle(cfg);
  config.update({ lastSyncAt: new Date().toISOString() });
  console.log(`[MekiSync] 완료 — ${count}개 노트 저장`);
}

// ── 데몬 루프 ──────────────────────────────────────────────────────────────

async function runDaemon() {
  const cfg = config.load();
  if (!cfg.githubToken) {
    console.error('❌ 설정이 없습니다. node index.js setup 을 먼저 실행하세요.');
    process.exit(1);
  }

  console.log(`[MekiSync] 데몬 시작 — 폴링 간격 ${cfg.pollIntervalMs / 60000}분`);
  tryLoadMenubar(cfg);

  // 최초 1회 즉시 실행
  await tick();

  // 주기적 폴링
  setInterval(tick, cfg.pollIntervalMs);

  async function tick() {
    try {
      const current = config.load(); // 설정 변경 실시간 반영
      const count = await syncCycle(current);
      config.update({ lastSyncAt: new Date().toISOString() });
      if (count > 0) {
        console.log(`[MekiSync] ${new Date().toLocaleTimeString()} — ${count}개 신규 노트 동기화`);
        notify(`${count}개 노트가 Meki에 동기화됐습니다`);
      }
    } catch (err) {
      console.error('[MekiSync] 동기화 오류:', err.message);
    }
  }
}

async function syncCycle(cfg) {
  const since = cfg.lastSyncAt;
  const allNotes = [];

  if (cfg.sources.includes('apple') && process.platform === 'darwin') {
    const notes = await extractAppleNotes(since);
    allNotes.push(...notes);
  }

  if (cfg.sources.includes('samsung') && cfg.samsungNotesDir) {
    const notes = await extractSamsungNotes(cfg.samsungNotesDir, since);
    allNotes.push(...notes);
  }

  if (!allNotes.length) return 0;
  return pushToGitHub(allNotes, cfg);
}

// ── 자동 시작 등록/해제 ────────────────────────────────────────────────────

function runInstall() {
  if (process.platform === 'darwin') return installLaunchd();
  if (process.platform === 'win32') return installTaskScheduler();
  console.log('자동 시작은 Mac과 Windows에서만 지원됩니다.');
  console.log('Linux: crontab -e 에서 직접 등록해 주세요.');
}

function runUninstall() {
  if (process.platform === 'darwin') return uninstallLaunchd();
  if (process.platform === 'win32') {
    const { execSync } = require('child_process');
    execSync('schtasks /delete /tn "MekiSync" /f', { stdio: 'inherit' });
  }
}

function installLaunchd() {
  const fs = require('fs');
  const os = require('os');
  const nodePath = process.execPath;
  const scriptPath = require('path').resolve(__filename);
  const plistPath = `${os.homedir()}/Library/LaunchAgents/com.meki.sync.plist`;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>com.meki.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${scriptPath}</string>
  </array>
  <key>RunAtLoad</key>         <true/>
  <key>KeepAlive</key>         <true/>
  <key>StandardOutPath</key>   <string>${os.homedir()}/Library/Logs/MekiSync.log</string>
  <key>StandardErrorPath</key> <string>${os.homedir()}/Library/Logs/MekiSync.err</string>
</dict>
</plist>`;

  fs.writeFileSync(plistPath, plist);
  const { execSync } = require('child_process');
  execSync(`launchctl load "${plistPath}"`, { stdio: 'inherit' });
  console.log('✅ Mac 자동 시작 등록 완료 (launchd)');
  console.log(`   로그: ~/Library/Logs/MekiSync.log`);
}

function uninstallLaunchd() {
  const os = require('os');
  const plistPath = `${os.homedir()}/Library/LaunchAgents/com.meki.sync.plist`;
  const { execSync } = require('child_process');
  try { execSync(`launchctl unload "${plistPath}"`, { stdio: 'inherit' }); } catch { }
  require('fs').rmSync(plistPath, { force: true });
  console.log('✅ Mac 자동 시작 해제 완료');
}

function installTaskScheduler() {
  const { execSync } = require('child_process');
  const nodePath = process.execPath;
  const scriptPath = require('path').resolve(__filename);
  const cmd = `schtasks /create /tn "MekiSync" /tr "${nodePath} ${scriptPath}" /sc ONLOGON /rl LIMITED /f`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Windows 작업 스케줄러 등록 완료');
}

// ── 알림 ──────────────────────────────────────────────────────────────────

function notify(message) {
  try {
    if (process.platform === 'darwin') {
      const { execFile } = require('child_process');
      execFile('osascript', ['-e',
        `display notification "${message}" with title "MekiSync"`]);
    }
    // Windows: node-notifier 선택적 의존성
  } catch { /* 알림 실패는 무시 */ }
}

// ── 메뉴바/트레이 (선택적 의존성) ─────────────────────────────────────────

function tryLoadMenubar(cfg) {
  try {
    // menubar 패키지 설치 시 활성화: npm install menubar
    // 미설치면 폴링만 동작 (데몬 기능은 동일)
    // eslint-disable-next-line
    const { menubar } = require('menubar');
    const mb = menubar({ tooltip: 'MekiSync' });
    mb.on('ready', () => console.log('[MekiSync] 메뉴바 활성화'));
  } catch {
    // menubar 미설치 — 무시
  }
}

main().catch(err => {
  console.error('[MekiSync] 치명적 오류:', err);
  process.exit(1);
});
