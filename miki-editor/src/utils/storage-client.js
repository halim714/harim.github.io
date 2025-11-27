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
      const { data: frontMatter } = parseFrontMatter(content);
      const metadata = extractMetadata(content);

      return {
        id: frontMatter.docId || id, // docId 우선
        filename: filename,
        title: metadata.title || id,
        content: content,
        sha: file.sha,
        metadata,
        updatedAt: frontMatter.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to fetch post ${id}:`, error);
      throw new Error(`문서를 불러올 수 없습니다: ${error.message}`);
    }
  },

  async savePost(post) {
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
    const { data: frontMatter, content: body } = parseFrontMatter(post.content || '');

    const now = new Date().toISOString();

    const updatedFrontMatter = {
      ...frontMatter,
      docId: docId, // ✅ docId 주입
      title: title,
      // ✅ CRITICAL FIX: 기존 updatedAt이 있으면 유지, 없거나 새 문서면 현재 시간
      updatedAt: frontMatter.updatedAt || post.updatedAt || now,
      createdAt: frontMatter.createdAt || post.createdAt || now
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