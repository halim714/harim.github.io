// src/utils/storage-client.js
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';
import { generateDocumentId, isTemporaryId } from './id-generator';
import { parseFrontMatter, stringifyFrontMatter, extractTitle, extractMetadata } from './markdown';
import { slugify, generateUniqueFilename } from './slugify';

// 헬퍼: GitHubService 인스턴스 생성 (캐싱 적용)
let githubInstance = null;
let currentToken = null;

const getGithub = async () => {
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

import { dbHelpers, db } from './database';

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
        githubPosts = files
          .filter(f => f.name.endsWith('.md'))
          .map(f => {
            const { data: frontMatter, content: body } = parseFrontMatter(f.text);
            const docId = frontMatter.docId || f.name.replace('.md', '');
            const filename = f.name.replace('.md', '');

            return {
              id: docId,
              filename: filename,
              title: frontMatter.title || extractTitle(body) || filename.replace(/-/g, ' '),
              updatedAt: frontMatter.updatedAt || new Date().toISOString(),
              createdAt: frontMatter.createdAt || new Date().toISOString(),
              status: frontMatter.status || (frontMatter.published ? 'published' : 'draft'),
              size: f.text.length,
              preview: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
              path: f.path,
              hasDocId: !!frontMatter.docId,
              source: 'github' // 디버깅용
            };
          });
      }
    } catch (error) {
      console.warn('GitHub fetch failed (offline?):', error);
      // 오프라인이거나 에러 시 로컬 데이터만으로 진행
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
        filename: existing?.filename || docId, // 파일명은 기존 것 유지하거나 ID 사용
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

    // ✅ Hybrid Identity: docId로 찾기, 실패하면 filename으로 찾기
    const postList = await this.getPostList();
    const post = postList.find(p => p.id === id);

    if (!post) {
      throw new Error(`문서를 찾을 수 없습니다: ${id}`);
    }

    try {
      const filename = post.filename || id;
      console.log(`Fetching post: docId=${id}, filename=${filename}`);

      const file = await github.getFile('miki-data', `miki-editor/posts/${filename}.md`);

      if (!file.content) {
        throw new Error('File content is empty or missing');
      }

      const content = decodeContent(file.content);
      const { data: frontMatter, content: body } = parseFrontMatter(content);
      const metadata = extractMetadata(content);

      return {
        id: frontMatter.docId || id, // docId 우선
        filename: filename,
        title: frontMatter.title || metadata.title || id,
        content: body, // ✅ 메타데이터가 제거된 순수 본문만 반환
        frontMatter: frontMatter, // ✅ 원본 메타데이터 보존 (저장 시 사용)
        sha: file.sha,
        metadata,
        updatedAt: frontMatter.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to fetch post ${id}:`, error);
      throw new Error(`문서를 불러올 수 없습니다: ${error.message}`);
    }
  },

  // 🟢 [New] Local-First 래퍼 함수
  async savePost(post) {
    let docToSave = { ...post };

    // 1. 🟢 [Fix] 임시 ID면 즉시 영구 ID 발급 및 교체 (Client-Side ID Stabilization)
    // 이렇게 해야 에디터와 GitHub가 동일한 ID를 사용하게 되어 "Split Brain" 방지
    if (isTemporaryId(docToSave.id)) {
      const newId = generateDocumentId();
      console.log(`🔄 [ID-STABILIZE] 임시 ID(${docToSave.id}) → 영구 ID(${newId}) 교체`);

      docToSave.id = newId;
      docToSave.frontMatter = {
        ...(docToSave.frontMatter || {}),
        docId: newId
      };

      // 구 임시 데이터 삭제 (IndexedDB)
      await dbHelpers.deleteLocal(post.id);
    }

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
        // 실패해도 로컬엔 남아있음 (추후 Retry 로직 추가 가능)
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

  // 🔴 [Rename] 기존 로직은 그대로 보존 (파일명 생성, Slug 처리 등 핵심 로직)
  async _savePostToGitHub(post) {
    const github = await getGithub();

    // ✅ 1. docId 확정 (새 문서면 생성, 기존 문서면 유지)
    let docId = post.id;
    if (isTemporaryId(docId)) {
      docId = generateDocumentId();
      console.log(`🆕 [SAVE] 새 docId 생성: ${docId}`);
    } else {
      console.log(`📝 [SAVE] 기존 docId 유지: ${docId}`);
    }

    // ✅ 2. 파일명 결정 (slug 기반)
    const title = post.title || extractTitle(post.content);
    const slug = slugify(title);

    // ✅ 3. 기존 문서인지 확인 (docId로 검색)
    const postList = await this.getPostList();
    const existingPost = postList.find(p => p.id === docId);

    let filename;
    let oldFilename = null;

    if (existingPost) {
      // 기존 문서: 파일명이 slug와 다르면 변경
      const currentFilename = existingPost.filename;
      if (currentFilename !== slug) {
        // 파일명 변경 (slug 중복 체크)
        const existingFilenames = postList
          .filter(p => p.id !== docId)
          .map(p => p.filename);

        filename = generateUniqueFilename(slug, existingFilenames.map(f => `${f}.md`)).replace('.md', '');
        oldFilename = currentFilename;
        console.log(`🔄 [SAVE] 파일명 변경: ${oldFilename}.md → ${filename}.md`);
      } else {
        filename = currentFilename;
        console.log(`💾 [SAVE] 파일명 유지: ${filename}.md`);
      }
    } else {
      // 새 문서: slug로 파일명 생성 (중복 체크)
      const existingFilenames = postList.map(p => p.filename);
      filename = generateUniqueFilename(slug, existingFilenames.map(f => `${f}.md`)).replace('.md', '');
      console.log(`🆕 [SAVE] 새 파일명 생성: ${filename}.md`);
    }

    // ✅ 4. Front Matter 주입
    // 에디터에서 온 content는 본문만 있음.
    // 기존 frontMatter(post.frontMatter)와 현재 본문에서 파싱한 frontMatter(혹시 사용자가 썼을 수도 있음)를 병합
    const { data: newFrontMatter, content: body } = parseFrontMatter(post.content || '');

    // 기존 메타데이터 (로드 시 보존된 것)
    const preservedFrontMatter = post.frontMatter || {};

    const now = new Date().toISOString();

    const updatedFrontMatter = {
      ...preservedFrontMatter, // 기존 메타데이터 유지 (태그 등)
      ...newFrontMatter,       // 새로 파싱된 메타데이터 (있다면 덮어씀)
      docId: docId,            // docId 강제 주입
      title: title,
      updatedAt: preservedFrontMatter.updatedAt || post.updatedAt || now,
      createdAt: preservedFrontMatter.createdAt || post.createdAt || now
    };

    const updatedContent = stringifyFrontMatter(updatedFrontMatter) + body;

    // ✅ 5. 파일 저장
    const sha = await github.createOrUpdateFile(
      'miki-data',
      `miki-editor/posts/${filename}.md`,
      updatedContent,
      `Save: ${title}`,
      post.sha || (existingPost ? existingPost.sha : undefined)
    );

    // ✅ 6. 파일명 변경 시 구 파일 삭제
    if (oldFilename) {
      try {
        const oldFile = await github.getFile('miki-data', `miki-editor/posts/${oldFilename}.md`);
        await github.deleteFile(
          'miki-data',
          `miki-editor/posts/${oldFilename}.md`,
          `Rename: ${oldFilename}.md → ${filename}.md`,
          oldFile.sha
        );
        console.log(`✅ [SAVE] 구 파일 삭제 완료: ${oldFilename}.md`);
      } catch (e) {
        console.warn(`⚠️ [SAVE] 구 파일 삭제 실패 (무시): ${oldFilename}.md`, e);
      }
    }

    return {
      ...post,
      id: docId,
      filename: filename,
      title,
      sha,
      frontMatter: updatedFrontMatter, // ✅ 업데이트된 메타데이터 반환
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