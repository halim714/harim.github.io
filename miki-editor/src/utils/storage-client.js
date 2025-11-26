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
import { extractTitle, extractMetadata } from './markdown';

// ... (AuthService, GitHubService imports and helpers remain same) ...

export const storage = {
  async getPostList() {
    const github = await getGithub();
    try {
      console.log('Fetching post list from:', 'miki-data', 'miki-editor/posts');
      const files = await github.getFiles('miki-data', 'miki-editor/posts');
      console.log('Raw files response:', files);

      if (!Array.isArray(files)) {
        console.error('Expected array of files, got:', files);
        return [];
      }

      // .gitkeep 등 제외하고 md 파일만 필터링
      const posts = files
        .filter(f => f.name.endsWith('.md'))
        .map(f => ({
          id: f.name.replace('.md', ''),
          title: f.name.replace('.md', '').replace(/-/g, ' '), // 임시 제목 (메타데이터 파싱 전)
          updatedAt: new Date().toISOString(), // GitHub API는 리스트에서 날짜 안 줌
          size: f.size,
          sha: f.sha,
          path: f.path
        }));

      console.log('Processed posts:', posts);
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

    // 기존 파일 목록 조회 (중복 방지)
    // 주의: 매번 리스트를 불러오는 것은 비효율적일 수 있으나, 충돌 방지를 위해 안전함.
    const existingFiles = await this.getPostList();
    const existingFilenames = existingFiles.map(f => `${f.id}.md`);

    // 고유한 파일명 생성
    // ID가 이미 있으면(수정 시) 그 ID 유지, 없으면(새 글) Slug 기반 생성
    let id = post.id;
    let filename;

    if (!id || id.startsWith('memo_')) { // 임시 ID이거나 새 글인 경우
      filename = generateUniqueFilename(slug, existingFilenames);
      id = filename.replace('.md', '');
    } else {
      filename = `${id}.md`;
    }

    const sha = await github.createOrUpdateFile(
      'miki-data',
      `miki-editor/posts/${filename}`,
      post.content || '',
      `Create/Update ${title}`,
      post.sha
    );

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