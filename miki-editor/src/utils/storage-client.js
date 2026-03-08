// src/utils/storage-client.js
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';
import { getWsClient } from '../services/ws-client';
import { generateDocumentId, isTemporaryId } from './id-generator';
import { parseFrontMatter, stringifyFrontMatter, extractTitle, extractMetadata } from './markdown';
import {
  slugify,
  generateUniqueFilename,
  parseFilename,
  generateFilename,
  isDocumentFile
} from './slugify';
import { useVaultStore } from '../stores/useVaultStore';
import { VaultService } from './vault';

// WS 인증 에러 또는 로그아웃 시 github 인스턴스 캐시 리셋
if (typeof window !== 'undefined') {
  const resetGithubCache = () => {
    githubInstance = null;
    currentToken = null;
  };
  window.addEventListener('meki:auth-error', resetGithubCache);
  window.addEventListener('meki:logout', resetGithubCache);
}

// WS 모드용 GitHubService 인터페이스 구현 (ws-client 경유)
class WsGitHubProxy {
  constructor() {
    this.username = null;
  }

  async setUsername() {
    const data = await getWsClient().request('github.getUser');
    this.username = data.login;
    return this.username;
  }

  async getFilesWithMetadata(repoName, path) {
    return getWsClient().request('github.getFilesWithMeta', { repoName, path });
  }

  async getFile(repoName, path) {
    const data = await getWsClient().request('github.getFile', { repoName, path });
    // ws-handler returns decoded UTF-8; re-encode to base64 for decodeContent() compatibility
    const base64 = btoa(unescape(encodeURIComponent(data.content)));
    return { ...data, content: base64 };
  }

  async createOrUpdateFile(repoName, path, content, message, sha, opts = {}) {
    return getWsClient().request('github.createOrUpdateFile', {
      repoName, path, content, message,
      sha: sha || undefined,
      skipShaLookup: opts.skipShaLookup || false,
    });
  }

  async deleteFile(repoName, path, message, sha) {
    return getWsClient().request('github.deleteFile', { repoName, path, message, sha });
  }
}

// 헬퍼: GitHubService 인스턴스 생성 (캐싱 적용)
let githubInstance = null;
let currentToken = null;

const getGithub = async () => {
  const isWsMode = import.meta.env.VITE_USE_WS_PROXY === 'true';

  if (isWsMode) {
    // WS 모드: WsGitHubProxy 사용 (토큰 불필요, ws-client 경유)
    if (githubInstance instanceof WsGitHubProxy) {
      return githubInstance;
    }
    const proxy = new WsGitHubProxy();
    await proxy.setUsername();
    githubInstance = proxy;
    currentToken = '__ws__';
    return githubInstance;
  }

  const token = AuthService.getToken();
  if (!token) throw new Error('로그인이 필요합니다.');

  // 토큰이 같으면 기존 인스턴스 재사용
  if (githubInstance && currentToken === token) {
    return githubInstance;
  }

  const github = new GitHubService(token);
  await github.setUsername(); // 사용자 이름 설정

  githubInstance = github;
  currentToken = token;

  return github;
};

// 헬퍼: Base64 디코딩 (한글 깨짐 방지)
const decodeContent = (base64) => {
  try {
    return decodeURIComponent(escape(window.atob(base64)));
  } catch (e) {
    return window.atob(base64);
  }
};

// 헬퍼: E2EE 복호화 래퍼
async function decryptContentIfNeeded(content) {
  if (typeof content === 'string' && content.startsWith('MEKI_E2EE:')) {
    const vaultState = useVaultStore.getState();
    if (!vaultState.isVaultReady || !vaultState.cryptoKey) {
      return '---\ntitle: 암호화된 문서\n---\n⚠️ [암호화된 문서입니다. 개인 설정에서 Vault(볼트) Seed를 입력하여 접근을 해제해주세요.]';
    }
    try {
      const encryptedData = content.substring(10);
      return await VaultService.decrypt(encryptedData, vaultState.cryptoKey);
    } catch (e) {
      return '---\ntitle: 복호화 실패\n---\n⚠️ [문서 복호화에 실패했습니다. 올바른 복구 Seed인지 확인해주세요.]';
    }
  }
  return content;
}

// 🛠 유틸리티: 문서별 독립 디바운스 관리자
class DebounceMap {
  constructor() {
    this.timers = new Map();
  }

  run(key, func, delay) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);
      func();
    }, delay);

    this.timers.set(key, timer);
  }
}

const saveDebouncer = new DebounceMap();

// 🗑️ 백그라운드 파일 정리 큐
class CleanupQueue {
  constructor() {
    this.orphans = new Set();
    this.isProcessing = false;
  }

  add(filename, sha, reason = 'orphan') {
    this.orphans.add({ filename, sha, reason, addedAt: Date.now() });
    console.log(`🗑️ [Cleanup] 큐에 추가 (${reason}): ${filename}`);
  }

  async process() {
    if (this.isProcessing || this.orphans.size === 0) return;

    this.isProcessing = true;

    try {
      const github = await getGithub();

      for (const orphan of this.orphans) {
        try {
          await github.deleteFile(
            'miki-data',
            `miki-editor/posts/${orphan.filename}.md`,
            `Cleanup: remove ${orphan.reason} ${orphan.filename}`,
            orphan.sha
          );
          console.log(`✅ [Cleanup] 삭제 완료: ${orphan.filename}`);
          this.orphans.delete(orphan);
        } catch (e) {
          // 30초 경과 시 포기
          const age = Date.now() - orphan.addedAt;
          if (age > 30000) {
            console.error(`❌ [Cleanup] 삭제 포기: ${orphan.filename}`, e);
            this.orphans.delete(orphan);
          } else {
            console.warn(`⚠️ [Cleanup] 삭제 실패, 재시도: ${orphan.filename}`, e);
          }
        }
      }
    } catch (error) {
      console.error('❌ [Cleanup] GitHub 인스턴스 생성 실패:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

const cleanupQueue = new CleanupQueue();

// 주기적 실행 (10초마다)
if (typeof window !== 'undefined') {
  setInterval(() => cleanupQueue.process(), 10000);
}

// 🔒 Rename Lock (Race Condition 방지)
const renameInProgress = new Set();

import { dbHelpers, db, PendingSync } from './database';

export const storage = {
  // ... getPostList, getPost 등 기존 코드 ...
  async getPostList() {
    const github = await getGithub();
    let githubPosts = [];

    // 1. GitHub 데이터 가져오기 (실패 시 빈 배열 처리하여 오프라인 지원)
    try {
      console.log('Fetching post list with GraphQL from:', 'miki-data', 'miki-editor/posts');
      const files = await github.getFilesWithMetadata('miki-data', 'miki-editor/posts');

      if (Array.isArray(files)) {
        const validFiles = files.filter(f => {
          const isValid = isDocumentFile(f.path, f.name);
          if (!isValid) {
            console.log(`⏭️ [getPostList] 비문서 파일 필터링: ${f.name}`);
          }
          return isValid;
        });

        githubPosts = await Promise.all(validFiles.map(async f => {
          // 복호화 파이프라인 적용
          const decryptedText = await decryptContentIfNeeded(f.text);
          const { data: frontMatter, content: body } = parseFrontMatter(decryptedText);
          const filename = f.name.replace('.md', '');

          const parsed = parseFilename(f.name);

          let docId = frontMatter.docId;
          if (!docId && parsed.uuid8) {
            docId = parsed.uuid8;
          }
          if (!docId) {
            docId = filename;
          }

          return {
            id: docId,
            sha: f.sha,
            filename: filename,
            title: frontMatter.title || extractTitle(body) || filename.replace(/-/g, ' '),
            updatedAt: frontMatter.updatedAt || new Date().toISOString(),
            createdAt: frontMatter.createdAt || new Date().toISOString(),
            status: frontMatter.status || (frontMatter.published ? 'published' : 'draft'),
            size: decryptedText.length,
            preview: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
            path: f.path,
            hasDocId: !!frontMatter.docId,
            isLegacyFilename: parsed.isLegacy,
            source: 'github'
          };
        }));

        // ✅ Self-Healing: 동일 docId 중복 제거 (최신 updatedAt 기준)
        githubPosts = Object.values(
          githubPosts.reduce((acc, post) => {
            if (!acc[post.id]) {
              acc[post.id] = post;
            } else {
              // 중복 발견
              const existing = acc[post.id];
              const newer = new Date(post.updatedAt) > new Date(existing.updatedAt) ? post : existing;
              const older = newer === post ? existing : post;

              console.warn(`⚠️ [Self-Healing] 중복 문서 발견: ${post.id}`);
              console.warn(`  기존: ${existing.filename} (${existing.updatedAt})`);
              console.warn(`  신규: ${post.filename} (${post.updatedAt})`);
              console.warn(`  선택: ${newer.filename}`);

              // 오래된 버전을 Cleanup Queue에 추가
              cleanupQueue.add(older.filename, older.sha, 'duplicate');

              acc[post.id] = newer;
            }
            return acc;
          }, {})
        );
      }
    } catch (error) {
      console.warn('GitHub fetch failed:', error);
      // 로컬 DB에 데이터가 있으면 오프라인 폴백, 없으면 에러 노출 (새 브라우저/계정전환 케이스)
      let localCount = 0;
      try { localCount = await db.documents.count(); } catch { /* ignore */ }
      if (localCount === 0) {
        // 로컬에 아무것도 없는 상태에서 GitHub도 실패 → 에러 노출
        throw error;
      }
      // 로컬 데이터 있음 → 오프라인 폴백 허용
    }

    // 2. 로컬 DB 데이터 가져오기
    let localPosts = [];
    try {
      localPosts = await db.documents.toArray();
    } catch (e) {
      console.error('Local DB fetch failed:', e);
    }

    // 3. 병합 (Local-First 정책)
    const mergedMap = new Map();

    // 3-1. GitHub 데이터 먼저 넣기
    githubPosts.forEach(post => {
      mergedMap.set(post.id, post);
    });

    // 3-2. 로컬 데이터로 덮어쓰기 (더 최신이거나, 미동기화 상태인 경우)
    localPosts.forEach(localDoc => {
      // localDoc.docId가 실제 문서 ID임 (스키마 v2 기준)
      const docId = localDoc.docId;
      if (!docId) return;

      const existing = mergedMap.get(docId);

      // 로컬 데이터 포맷팅
      const formattedLocal = {
        id: docId,
        filename: existing?.filename || localDoc.filename || docId, // 우선순위: GitHub > IndexedDB > docId
        title: localDoc.title,
        updatedAt: localDoc.updatedAt,
        createdAt: localDoc.createdAt || localDoc.updatedAt,
        status: 'draft',
        size: localDoc.content?.length || 0,
        preview: (localDoc.content || '').substring(0, 150),
        path: existing?.path, // 경로는 기존 것 유지
        hasDocId: true,
        source: 'local',
        synced: localDoc.synced
      };

      if (!existing) {
        // GitHub에 없는 새 문서 (로컬 전용)
        mergedMap.set(docId, formattedLocal);
      } else {
        // GitHub에 있지만 로컬이 더 최신이거나 미동기화 상태면 덮어쓰기
        const localTime = new Date(localDoc.updatedAt).getTime();
        const serverTime = new Date(existing.updatedAt).getTime();

        // 💡 핵심: 로컬이 미동기화 상태(synced: false)이거나, 시간이 더 뒤면 로컬 우선
        if (!localDoc.synced || localTime >= serverTime) {
          mergedMap.set(docId, {
            ...existing, // 기존 GitHub 정보(sha, path 등) 유지
            ...formattedLocal, // 로컬의 최신 내용(title, preview, updatedAt) 덮어쓰기
            source: 'local-merged'
          });
        }
      }
    });

    // 4. 배열 변환 및 정렬
    const posts = Array.from(mergedMap.values());
    posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    console.log(`Merged posts: ${posts.length} (GitHub: ${githubPosts.length}, Local: ${localPosts.length})`);
    return posts;
  },

  async getPost(id) {
    const github = await getGithub();
    const postList = await this.getPostList();
    const post = postList.find(p => p.id === id);

    // ✅ Optimistic Filename Creation
    let filename;
    if (!post) {
      // 1순위: 로컬 캐시 확인 (IndexedDB)
      const localDoc = await db.documents.where('docId').equals(id).first();
      if (localDoc && localDoc.filename) {
        filename = localDoc.filename;
        console.log(`📦 [getPost] 로컬 캐시에서 filename 복구: ${filename}`);
      } else {
        // 2순위: createdAt 기반 예상 파일명 생성
        const now = new Date().toISOString();
        filename = generateFilename(now, '새 메모', id);
        console.log(`🔮 [getPost] 예상 filename 생성: ${filename}`);
      }
    } else {
      filename = post.filename;
    }

    console.log(`Fetching post: docId=${id}, filename=${filename}`);

    try {
      const file = await github.getFile('miki-data', `miki-editor/posts/${filename}.md`);

      if (!file.content) {
        throw new Error('File content is empty or missing');
      }

      let rawContent = decodeContent(file.content);
      const content = await decryptContentIfNeeded(rawContent);
      const { data: frontMatter, content: body } = parseFrontMatter(content);
      const metadata = extractMetadata(content);

      // ✅ Lazy Migration: 레거시 파일 감지 및 즉시 마이그레이션
      let needsMigration = false;
      if (!frontMatter.docId) {
        console.warn(`🔄 [Migration] 레거시 파일 감지: ${filename}`);
        needsMigration = true;

        // UUID 생성 및 주입
        frontMatter.docId = frontMatter.docId || generateDocumentId();
        frontMatter.title = frontMatter.title || extractTitle(body) || filename;
        frontMatter.createdAt = frontMatter.createdAt || new Date().toISOString();
        frontMatter.updatedAt = new Date().toISOString();
      }

      // 마이그레이션 필요 시 즉시 저장
      if (needsMigration) {
        const updatedContent = stringifyFrontMatter(frontMatter) + body;

        try {
          await github.createOrUpdateFile(
            'miki-data',
            `miki-editor/posts/${filename}.md`,
            updatedContent,
            `Migration: add docId to ${filename}`,
            file.sha
          );
          console.log(`✅ [Migration] UUID 주입 완료: ${frontMatter.docId}`);
        } catch (e) {
          console.error(`❌ [Migration] 실패: ${filename}`, e);
          // 실패해도 읽기는 계속 진행
        }
      }

      return {
        id: frontMatter.docId || id,
        filename: filename,
        title: frontMatter.title || metadata.title || id,
        content: body,
        frontMatter: frontMatter,
        sha: file.sha,
        metadata,
        updatedAt: frontMatter.updatedAt || new Date().toISOString(),
        wasMigrated: needsMigration // 디버깅용
      };
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`문서를 찾을 수 없습니다: ${id} (filename: ${filename})`);
      }
      console.error(`Failed to fetch post ${id}:`, error);
      throw new Error(`문서를 불러올 수 없습니다: ${error.message}`);
    }
  },

  // 🟢 [New] Local-First 래퍼 함수
  async savePost(post) {
    let docToSave = { ...post };

    // 1. 🟢 [Fix] 임시 ID면 즉시 영구 ID 발급 및 교체 (Client-Side ID Stabilization)
    // 이렇게 해야 에디터와 GitHub가 동일한 ID를 사용하게 되어 "Split Brain" 방지
    // 1. 🟢 [Client-Side UUID] 이미 UUID이므로 별도 처리 불필요
    // (Phase 3 레거시 마이그레이션은 별도 로직에서 처리)

    // 2. 로컬 DB에 즉시 저장 (0ms)
    // 이제 영구 ID로 저장되므로, 이후 GitHub 저장 시에도 이 ID가 유지됨
    await dbHelpers.saveLocal(docToSave);

    // 3. GitHub 저장은 백그라운드 + 디바운스 (5초)
    // 문서 ID별로 타이머가 따로 돌아가므로 A문서 저장이 B문서 저장을 방해하지 않음
    saveDebouncer.run(docToSave.id, async () => {
      try {
        console.log(`☁️ [GitHub] 백그라운드 저장 시작: ${docToSave.title}`);

        // 기존의 복잡한 로직(파일명/Slug 등)을 그대로 재사용!
        const saved = await this._savePostToGitHub(docToSave);

        // 성공 시 로컬 DB에 동기화 완료 표시
        // 🟢 [변경] filename도 같이 업데이트하여 영구 보존
        await dbHelpers.markSyncedWithUpdate(saved.id, {
          filename: saved.filename
        });
        console.log(`✅ [GitHub] 백그라운드 저장 완료: ${docToSave.title}`);
      } catch (error) {
        console.error(`❌ [GitHub] 백그라운드 저장 실패: ${docToSave.title}`, error);
        // 오프라인/네트워크 오류 → pendingSync 큐에 등록하여 재연결 시 배치 동기화
        try {
          await PendingSync.enqueue(docToSave.id, 'update', docToSave);
          console.log(`📥 [pendingSync] 재시도 큐 등록: ${docToSave.id}`);
        } catch (queueErr) {
          console.error('❌ [pendingSync] 큐 등록 실패:', queueErr);
        }
      }
    }, 5000);

    // 4. UI에는 즉시 성공 응답 (기다리지 않음)
    // 🟢 [Fix] 변경된 ID가 포함된 docToSave를 반환하여 에디터가 ID를 업데이트하도록 함
    return {
      ...docToSave,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };
  },

  // 🔴 [Migration] 새 파일명 패턴 적용
  async _savePostToGitHub(post) {
    const github = await getGithub();
    const docId = post.id;

    // 🔒 동일 문서에 대한 동시 Rename 방지
    if (renameInProgress.has(docId)) {
      console.log(`⏳ [SAVE] Rename 진행 중, 대기: ${docId}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this._savePostToGitHub(post); // 재시도
    }

    console.log(`📝 [SAVE] docId 사용: ${docId}`);

    // ✅ 1. 제목 추출
    const title = post.title || extractTitle(post.content) || '새 메모';

    // ✅ 2. 기존 문서 확인 (UUID 기반)
    const postList = await this.getPostList();
    const existingPost = postList.find(p => p.id === docId);

    // ✅ 3. 파일명 결정 (새 패턴: YYYYMMDD-slug-uuid8)
    const createdAt = existingPost?.createdAt || post.createdAt || new Date().toISOString();
    const newFilename = generateFilename(createdAt, title, docId);

    // ✅ 4. 파일명 변경 여부 확인
    const oldFilename = existingPost?.filename;
    const filenameChanged = oldFilename && oldFilename !== newFilename;

    if (filenameChanged) {
      console.log(`🔄 [SAVE] 파일명 변경: ${oldFilename}.md → ${newFilename}.md`);
      renameInProgress.add(docId); // Lock 설정
    } else if (!oldFilename) {
      console.log(`🆕 [SAVE] 새 파일명: ${newFilename}.md`);
    } else {
      console.log(`💾 [SAVE] 파일명 유지: ${newFilename}.md`);
    }

    // ✅ 5. Front Matter 구성
    const { data: newFrontMatter, content: body } = parseFrontMatter(post.content || '');
    const preservedFrontMatter = post.frontMatter || {};
    const now = new Date().toISOString();

    const updatedFrontMatter = {
      ...preservedFrontMatter,
      ...newFrontMatter,
      docId: docId,
      title: title,
      updatedAt: now,
      createdAt: preservedFrontMatter.createdAt || createdAt,

      // ✅ permalink 자동 생성 (사용자가 직접 설정하지 않았다면)
      permalink: preservedFrontMatter.permalink ||
        newFrontMatter.permalink ||
        `/posts/${slugify(title)}/`,

      // ✅ slug 필드 추가 (Jekyll _config.yml에서 사용)
      slug: slugify(title)
    };

    const updatedContent = stringifyFrontMatter(updatedFrontMatter) + body;

    // === E2EE 암호화 파이프라인 ===
    let finalContent = updatedContent;
    const vaultState = useVaultStore.getState();
    if (vaultState.isVaultReady && vaultState.cryptoKey) {
      const encrypted = await VaultService.encrypt(updatedContent, vaultState.cryptoKey);
      finalContent = 'MEKI_E2EE:' + encrypted;
      console.log(`🔒 [SAVE] Vault E2EE 암호화 적용됨`);
    }

    // ✅ 6. 새 파일 저장 (또는 덮어쓰기)
    const isNewFile = !existingPost;
    let newSha;

    try {
      newSha = await github.createOrUpdateFile(
        'miki-data',
        `miki-editor/posts/${newFilename}.md`,
        finalContent,
        filenameChanged
          ? `Rename: ${oldFilename} → ${newFilename} [${docId.substring(0, 8)}]`
          : `Save: ${title} [${docId.substring(0, 8)}]`,
        // 파일명 변경 시 새 경로에는 SHA가 없음
        filenameChanged ? undefined : (post.sha || existingPost?.sha),
        { skipShaLookup: isNewFile || filenameChanged }
      );
    } catch (error) {
      renameInProgress.delete(docId);
      throw error;
    }

    // ✅ 7. 파일명 변경 시 구 파일 삭제 (캐시된 SHA 사용)
    if (filenameChanged && existingPost?.sha) {
      try {
        await github.deleteFile(
          'miki-data',
          `miki-editor/posts/${oldFilename}.md`,
          `Delete old: ${oldFilename}.md [${docId.substring(0, 8)}]`,
          existingPost.sha // 캐시된 SHA 사용, 추가 GET 불필요
        );
        console.log(`✅ [SAVE] 구 파일 삭제 완료: ${oldFilename}.md`);
      } catch (e) {
        // 삭제 실패 시 Cleanup Queue에 추가
        console.warn(`⚠️ [SAVE] 구 파일 삭제 실패, Cleanup Queue에 추가: ${oldFilename}.md`, e);
        cleanupQueue.add(oldFilename, existingPost.sha, 'rename-failed');
      } finally {
        renameInProgress.delete(docId); // Lock 해제
      }
    } else {
      renameInProgress.delete(docId); // Lock 해제 (Rename 아닌 경우)
    }

    return {
      ...post,
      id: docId,
      filename: newFilename,
      title,
      sha: newSha,
      frontMatter: updatedFrontMatter,
      updatedAt: updatedFrontMatter.updatedAt,
      createdAt: updatedFrontMatter.createdAt,
      metadata: extractMetadata(updatedContent)
    };
  },

  async updatePost(id, post) {
    // updatePost는 savePost로 위임 (docId 덕분에 통합 가능)
    return this.savePost({ ...post, id });
  },

  async deletePost(id) {
    const github = await getGithub();

    // 1. IndexedDB에서 먼저 찾기
    let localDoc = await db.documents.where('docId').equals(id).first();

    // 2. 없으면 목록에서 찾기
    if (!localDoc) {
      const postList = await this.getPostList();
      localDoc = postList.find(p => p.id === id);
    }

    if (!localDoc) {
      console.warn('문서 없음:', id);
      return { id };
    }

    // 🟢 [변경] DB에 저장된 filename 우선 사용
    // 만약 DB에 filename이 없다면(구 데이터), getPostList로 찾아옴 (폴백)
    if (!localDoc.filename) {
      try {
        const postList = await this.getPostList();
        const mergedDoc = postList.find(p => p.id === id);
        if (mergedDoc) {
          localDoc.filename = mergedDoc.filename; // 메모리상 업데이트
        }
      } catch (e) {
        console.warn('Fallback fetch failed:', e);
      }
    }

    const filename = localDoc.filename || id;

    // IndexedDB에서 직접 가져온 경우 frontMatter 확인
    const frontMatter = localDoc.frontMatter || {};

    // status 체크 수정
    const isPublished = frontMatter.status === 'published'
      || frontMatter.published === true;

    // 3. Private 삭제
    try {
      const file = await github.getFile('miki-data', `miki-editor/posts/${filename}.md`);
      await github.deleteFile(
        'miki-data',
        `miki-editor/posts/${filename}.md`,
        `Delete ${filename}`,
        file.sha
      );
      console.log('Private 삭제 완료');
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    // 4. Public 삭제 (백그라운드)
    if (isPublished) {
      this._deletePublicInBackground(github, localDoc, frontMatter).catch(e => {
        console.warn('Public 삭제 실패:', e);
      });
    }

    // 5. IndexedDB 삭제
    await dbHelpers.deleteLocal(id);

    return { id };
  },

  // 백그라운드 삭제 함수
  async _deletePublicInBackground(github, doc, frontMatter) {
    try {
      const username = github.username;
      const slug = slugify(doc.title);

      // frontMatter에서 날짜 가져오기
      const dateStr = frontMatter.publishedAt
        || frontMatter.date
        || doc.updatedAt
        || doc.createdAt
        || new Date().toISOString();
      const date = dateStr.split('T')[0];

      const publicPath = `_posts/${date}-${slug}.md`;
      const publicRepo = `${username}.github.io`;

      const publicFile = await github.getFile(publicRepo, publicPath);

      if (publicFile && publicFile.sha) {
        await github.deleteFile(
          publicRepo,
          publicPath,
          `Unpublish: ${doc.title}`,
          publicFile.sha
        );
        console.log('Public 삭제 완료 (백그라운드)');
      }
    } catch (error) {
      if (error.status === 404) {
        console.warn('Public 파일 없음');
      } else {
        throw error;
      }
    }
  }
};