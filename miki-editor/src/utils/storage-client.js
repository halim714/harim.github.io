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

export const storage = {
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

import { dbHelpers } from './database';

export const storage = {
  // ... getPostList, getPost 등 기존 코드 ...
  async getPostList() {
    const github = await getGithub();
    try {
      console.log('Fetching post list with GraphQL from:', 'miki-data', 'miki-editor/posts');

      const files = await github.getFilesWithMetadata('miki-data', 'miki-editor/posts');
      console.log('GraphQL raw files response:', files);

      if (!Array.isArray(files)) {
        console.error('Expected array of files, got:', files);
        return [];
      }

      // .gitkeep 등 제외하고 md 파일만 필터링
      const posts = files
        .filter(f => f.name.endsWith('.md'))
        .map(f => {
          // Front Matter 파싱
          const { data: frontMatter, content: body } = parseFrontMatter(f.text);

          // ✅ Hybrid Identity: docId 우선, 없으면 파일명
          const docId = frontMatter.docId || f.name.replace('.md', '');
          const filename = f.name.replace('.md', '');

          // 메타데이터 추출
          const title = frontMatter.title || extractTitle(body) || filename.replace(/-/g, ' ');
          const createdAt = frontMatter.createdAt || frontMatter.date || new Date().toISOString();
          const updatedAt = frontMatter.updatedAt || frontMatter.date || new Date().toISOString();
          const status = frontMatter.status || (frontMatter.published ? 'published' : 'draft');

          return {
            id: docId, // ✅ 이제 docId가 ID
            filename: filename, // 🔥 파일명은 별도 저장
            title: title,
            updatedAt: updatedAt,
            createdAt: createdAt,
            status: status,
            size: f.text.length,
            preview: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
            path: f.path,
            hasDocId: !!frontMatter.docId // 🔥 docId 존재 여부 플래그
          };
        });

      // 🔥 날짜 기준 내림차순 정렬 (최신순)
      posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      console.log('Processed posts with hybrid identity:', posts);
      return posts;
    } catch (error) {
      console.error('Failed to fetch post list:', error);
      return [];
    }
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
    // 1. 로컬 DB에 즉시 저장 (0ms)
    await dbHelpers.saveLocal(post);

    // 2. GitHub 저장은 백그라운드 + 디바운스 (5초)
    // 문서 ID별로 타이머가 따로 돌아가므로 A문서 저장이 B문서 저장을 방해하지 않음
    saveDebouncer.run(post.id, async () => {
      try {
        console.log(`☁️ [GitHub] 백그라운드 저장 시작: ${post.title}`);

        // 기존의 복잡한 로직(파일명/Slug 등)을 그대로 재사용!
        const saved = await this._savePostToGitHub(post);

        // 성공 시 로컬 DB에 동기화 완료 표시
        // saved.id는 docId이므로 정확함
        await dbHelpers.markSynced(saved.id);
        console.log(`✅ [GitHub] 백그라운드 저장 완료: ${post.title}`);
      } catch (error) {
        console.error(`❌ [GitHub] 백그라운드 저장 실패: ${post.title}`, error);
        // 실패해도 로컬엔 남아있음 (추후 Retry 로직 추가 가능)
      }
    }, 5000);

    // 3. UI에는 즉시 성공 응답 (기다리지 않음)
    return {
      ...post,
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

    // docId로 파일명 찾기
    const postList = await this.getPostList();
    const post = postList.find(p => p.id === id);

    if (!post) {
      console.warn(`⚠️ [DELETE] 문서 없음: ${id}`);
      return { id };
    }

    const filename = post.filename || id;

    try {
      const file = await github.getFile('miki-data', `miki-editor/posts/${filename}.md`);
      await github.deleteFile(
        'miki-data',
        `miki-editor/posts/${filename}.md`,
        `Delete ${filename}`,
        file.sha
      );
      console.log(`✅ [DELETE] 삭제 완료: ${filename}.md`);
    } catch (error) {
      if (error.status === 404) {
        console.warn(`⚠️ [DELETE] 이미 삭제된 파일: ${filename}.md`);
      } else {
        throw error;
      }
    }

    return { id };
  }
};