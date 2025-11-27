// src/utils/storage-client.js
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';

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

import { slugify, generateUniqueFilename } from './slugify';
import { extractTitle, extractMetadata, parseFrontMatter } from './markdown'; // parseFrontMatter 추가

// ... (AuthService, GitHubService imports and helpers remain same) ...

export const storage = {
  async getPostList() {
    const github = await getGithub();
    try {
      console.log('Fetching post list with GraphQL from:', 'miki-data', 'miki-editor/posts');

      // 🔥 GraphQL로 파일 목록 + 메타데이터(내용) 한 번에 가져오기
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

          // 메타데이터 추출
          const title = frontMatter.title || extractTitle(body) || f.name.replace('.md', '').replace(/-/g, ' ');
          const createdAt = frontMatter.createdAt || frontMatter.date || new Date().toISOString();
          const updatedAt = frontMatter.updatedAt || frontMatter.date || new Date().toISOString();
          const status = frontMatter.status || (frontMatter.published ? 'published' : 'draft');

          return {
            id: f.name.replace('.md', ''),
            title: title,
            updatedAt: updatedAt,
            createdAt: createdAt,
            status: status, // 배포 상태 (published/draft)
            size: f.text.length,
            preview: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
            path: f.path
          };
        });

      // 🔥 날짜 기준 내림차순 정렬 (최신순)
      posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      console.log('Processed posts with metadata:', posts);
      return posts;
    } catch (error) {
      console.error('Failed to fetch post list:', error);
      return [];
    }
  },

  async getPost(id) {
    const github = await getGithub();
    try {
      console.log(`Fetching post ${id}...`);
      const file = await github.getFile('miki-data', `miki-editor/posts/${id}.md`);
      console.log(`File fetched:`, file);

      if (!file.content) {
        throw new Error('File content is empty or missing');
      }

      const content = decodeContent(file.content);

      // 메타데이터 추출 (Front Matter 파싱이 필요하면 여기에 추가 로직 필요)
      // 현재는 마크다운 내용에서 추출
      const metadata = extractMetadata(content);

      return {
        id: id,
        title: metadata.title || id,
        content: content,
        sha: file.sha,
        metadata,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to fetch post ${id}:`, error);
      throw new Error(`문서를 불러올 수 없습니다: ${error.message}`);
    }
  },

  async savePost(post) {
    const github = await getGithub();

    // ✅ Slugify 적용: 제목 → 파일명
    const title = post.title || extractTitle(post.content);
    const slug = slugify(title);

    // 기존 파일 목록 조회 (중복 방지 및 기존 파일 찾기)
    const existingFiles = await this.getPostList();
    const existingFilenames = existingFiles.map(f => `${f.id}.md`);

    // 기존 ID가 있는지 확인
    let id = post.id;
    let filename;
    let oldFilename = null;

    // 🔥 CRITICAL FIX: memo_ ID를 가진 새 문서 처리
    if (!id || id.startsWith('memo_')) {
      // 1. 새 글인 경우: Slug 기반 새 파일명 생성
      filename = generateUniqueFilename(slug, existingFilenames);
      id = filename.replace('.md', '');
      console.log(`📝 [SAVE] 새 문서 생성: memo_ → ${id}`);
    } else {
      // 2. 기존 글인 경우: 제목이 바뀌었는지 확인
      const currentSlug = slugify(title);

      // 현재 ID와 예상되는 파일명이 다르면 (제목이 바뀌어서 슬러그가 달라짐)
      if (id !== currentSlug && existingFiles.find(f => f.id === id)) {
        // 이름 변경 로직: 새 파일명 생성
        filename = generateUniqueFilename(currentSlug, existingFilenames);
        oldFilename = `${id}.md`; // 삭제할 구 파일명
        console.log(`🔄 [SAVE] 파일명 변경: ${id}.md → ${filename}`);
        id = filename.replace('.md', ''); // 새 ID 할당
      } else {
        // 제목이 같거나 변경 불필요
        filename = `${id}.md`;
        console.log(`💾 [SAVE] 기존 문서 업데이트: ${id}`);
      }
    }

    // 파일 생성/업데이트
    const sha = await github.createOrUpdateFile(
      'miki-data',
      `miki-editor/posts/${filename}`,
      post.content || '',
      `Create/Update ${title}`,
      post.sha
    );

    // 이름이 바뀌었으면 기존 파일 삭제 (Renaming 효과)
    if (oldFilename) {
      try {
        const oldFile = existingFiles.find(f => f.id === oldFilename.replace('.md', ''));
        if (oldFile) {
          await github.deleteFile(
            'miki-data',
            `miki-editor/posts/${oldFilename}`,
            `Rename: ${oldFilename} -> ${filename}`,
            oldFile.sha
          );
        }
      } catch (e) {
        console.error('Failed to delete old file during rename:', e);
      }
    }

    return {
      ...post,
      id,
      title,
      sha,
      metadata: extractMetadata(post.content || '')
    };
  },

  async updatePost(id, post) {
    // savePost와 로직 공유 (ID가 있으므로 savePost가 알아서 처리)
    return this.savePost({ ...post, id });
  },

  async deletePost(id) {
    const github = await getGithub();
    const filename = `${id}.md`;

    // 삭제하려면 SHA가 필요함
    const file = await github.getFile('miki-data', `miki-editor/posts/${filename}`);

    await github.deleteFile(
      'miki-data',
      `miki-editor/posts/${filename}`,
      `Delete ${filename}`,
      file.sha
    );

    return { id };
  }
};