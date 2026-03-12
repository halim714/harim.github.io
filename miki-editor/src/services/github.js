import { Octokit } from 'octokit';

/**
 * GitHub 세션 만료 에러
 */
export class SessionExpiredError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SessionExpiredError';
    }
}

/**
 * GitHub Service
 * 기존 server/onboarding.js를 프론트엔드로 이동
 * 100% 동일한 로직 (검증 완료)
 */
export class GitHubService {
    constructor(token) {
        this.octokit = new Octokit({
            auth: token,
            retry: {
                doNotRetry: [400, 401, 403, 404, 409, 410, 422, 451]
            }
        });
        this.username = null;
    }

    /**
     * 사용자 이름 설정
     */
    async setUsername() {
        const { data } = await this.octokit.rest.users.getAuthenticated();
        this.username = data.login;
        return this.username;
    }

    /**
     * 지연 헬퍼
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 재시도 래퍼 (GitHub API 전파 지연 대응)
     */
    async retryOperation(operation, maxRetries = 3, delayMs = 2000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                console.log(`Retry ${i + 1}/${maxRetries} after error:`, error.message);
                await this.delay(delayMs);
            }
        }
    }

    /**
     * 메인 초기화 함수
     */
    async initialize(options = {}) {
        await this.setUsername();

        // 1. 충돌 확인
        if (!options.useExisting) {
            const conflicts = await this.checkConflicts();
            if (conflicts.hasConflicts) {
                return {
                    success: false,
                    needsResolution: true,
                    error: 'Repository already exists',
                    conflicts
                };
            }
        }

        // 2. 저장소 생성
        const { dataRepo, pagesRepo } = await this.createRepositories(options.useExisting);

        // 3. Jekyll 설정
        await this.setupJekyll(pagesRepo);

        // 4. GitHub Pages 활성화
        await this.enablePages(pagesRepo);

        // 5. 초기 구조 생성
        await this.createInitialStructure(dataRepo);

        return {
            success: true,
            dataRepo: `${this.username}/miki-data`,
            pagesRepo: `${this.username}/${this.username}.github.io`,
            pagesUrl: `https://${this.username}.github.io`,
            estimatedDeployTime: '5-10 minutes'
        };
    }

    /**
     * 충돌 확인
     */
    async checkConflicts() {
        try {
            const [dataExists, pagesExists] = await Promise.all([
                this.checkRepoExists('miki-data'),
                this.checkRepoExists(`${this.username}.github.io`)
            ]);

            return {
                hasConflicts: dataExists || pagesExists,
                dataRepoExists: dataExists,
                pagesRepoExists: pagesExists,
                suggestions: {
                    dataRepo: dataExists ? 'miki-personal' : 'miki-data',
                    pagesRepo: pagesExists ? 'miki-blog' : `${this.username}.github.io`
                }
            };
        } catch (error) {
            if (error.status === 404) return { hasConflicts: false };
            throw error;
        }
    }

    /**
     * 저장소 존재 확인
     */
    async checkRepoExists(repoName) {
        try {
            await this.octokit.rest.repos.get({
                owner: this.username,
                repo: repoName
            });
            return true;
        } catch (error) {
            if (error.status === 404) return false;
            throw error;
        }
    }

    /**
     * 저장소 생성
     */
    async createRepositories(useExisting = false) {
        const createOrGet = async (name, description, isPrivate) => {
            try {
                const { data } = await this.octokit.rest.repos.createForAuthenticatedUser({
                    name,
                    description,
                    private: isPrivate,
                    auto_init: true
                });
                return data;
            } catch (error) {
                // 422 = 레포가 이미 존재함 -> 기존 레포 사용
                if (error.status === 422) {
                    try {
                        const { data } = await this.octokit.rest.repos.get({
                            owner: this.username,
                            repo: name
                        });
                        return data;
                    } catch (getError) {
                        throw error;
                    }
                }
                throw error;
            }
        };

        const [dataRepo, pagesRepo] = await Promise.all([
            createOrGet('miki-data', 'Miki Editor - Personal Wiki Data', true),
            createOrGet(`${this.username}.github.io`, 'Published by Miki Editor', false)
        ]);

        return { dataRepo, pagesRepo };
    }

    /**
     * Jekyll 설정 (파일 존재 시 덮어씀)
     */
    async setupJekyll(repo) {
        const files = [
            { path: '_config.yml', content: this.getJekyllConfig() },
            { path: 'index.md', content: this.getIndexPage() },
            { path: `_posts/${this.getTodayDate()}-welcome.md`, content: this.getWelcomePost() }
        ];

        for (const file of files) {
            await this.createOrUpdateFile(repo.name, file.path, file.content, `Setup: ${file.path}`);
        }
    }

    /**
     * GitHub Pages 활성화
     */
    async enablePages(repo) {
        try {
            await this.octokit.rest.repos.createPagesSite({
                owner: this.username,
                repo: repo.name,
                source: {
                    branch: 'main',
                    path: '/'
                }
            });
        } catch (error) {
            // 409 = 이미 활성화됨
            if (error.status !== 409) throw error;
        }
    }

    /**
     * 초기 디렉토리 구조 생성
     */
    async createInitialStructure(repo) {
        const readme = `# Miki Data Repository

This is your private wiki data storage.

## Structure

\`\`\`
miki-editor/
└── posts/ # Your markdown files
\`\`\`
`;

        // .gitkeep 생성 (이미 존재하면 무시)
        try {
            await this.createOrUpdateFile(repo.name, 'miki-editor/posts/.gitkeep', '', 'Initialize directory structure');
        } catch (error) {
            if (error.status !== 422) throw error;
        }

        // README 생성
        await this.createOrUpdateFile(repo.name, 'README.md', readme, 'Add README');
    }

    /**
     * 파일 목록 가져오기
     */
    async getFiles(repoName, path) {
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner: this.username,
                repo: repoName,
                path: path
            });

            // API 응답 타입 확인
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                // 단일 파일인 경우 배열로 감싸서 반환 (일관성 유지)
                return [data];
            } else {
                console.warn('Unexpected data type from GitHub API:', data);
                return [];
            }
        } catch (error) {
            if (error.status === 404) {
                console.warn(`Path not found: ${repoName}/${path}`);
                return [];
            }
            throw error;
        }
    }

    /**
     * 단일 파일 가져오기
     */
    async getFile(repoName, path) {
        const { data } = await this.octokit.rest.repos.getContent({
            owner: this.username,
            repo: repoName,
            path: path
        });

        // 파일 타입 확인
        if (Array.isArray(data)) {
            throw new Error(`Expected a file at ${path}, but found a directory.`);
        }

        if (data.type !== 'file') {
            throw new Error(`Expected a file at ${path}, but found type: ${data.type}`);
        }

        return data;
    }

    /**
     * 파일의 마지막 커밋 날짜 가져오기
     */
    async getLastCommitDate(repoName, path) {
        try {
            const { data } = await this.octokit.rest.repos.listCommits({
                owner: this.username,
                repo: repoName,
                path: path,
                per_page: 1
            });

            if (data && data.length > 0) {
                return data[0].commit.committer.date;
            }
            return null;
        } catch (error) {
            console.warn(`Failed to fetch commit date for ${path}:`, error);
            return null;
        }
    }

    /**
     * 파일 삭제
     */
    async deleteFile(repoName, path, message, sha) {
        await this.octokit.rest.repos.deleteFile({
            owner: this.username,
            repo: repoName,
            path: path,
            message: message,
            sha: sha
        });
    }

    /**
     * 파일 생성/업데이트 (SHA 자동 처리)
     */
    async createOrUpdateFile(repoName, path, content, message, sha = null, options = {}) {
        let currentSha = sha;

        // SHA가 없고 생략 옵션이 없는 경우만 조회 시도
        if (!currentSha && !options.skipShaLookup) {
            try {
                const { data } = await this.octokit.rest.repos.getContent({
                    owner: this.username,
                    repo: repoName,
                    path: path
                });
                currentSha = data.sha;
            } catch (error) {
                if (error.status !== 404) throw error;
            }
        }

        // 파일 생성/업데이트
        const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.username,
            repo: repoName,
            path: path,
            message: message,
            content: this.encodeContent(content),
            ...(currentSha && { sha: currentSha })
        });

        return data.content.sha; // 새로운 SHA 반환
    }

    /**
     * Browser-compatible Base64 encoding (handles UTF-8)
     */
    encodeContent(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    /**
     * GraphQL을 사용하여 파일 목록, 내용, SHA를 한 번에 가져오기
     */
    async getFilesWithMetadata(repoName, path) {
        try {
            const query = `
                query getPosts($owner: String!, $repo: String!, $path: String!) {
                    repository(owner: $owner, name: $repo) {
                        object(expression: $path) {
                            ... on Tree {
                                entries {
                                    name
                                    oid
                                    object {
                                        ... on Blob {
                                            text
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const expression = `HEAD:${path}`;
            const response = await this.octokit.graphql(query, {
                owner: this.username,
                repo: repoName,
                path: expression
            });

            const entries = response.repository?.object?.entries;
            if (!entries) return [];

            return entries.map(entry => ({
                name: entry.name,
                path: `${path}/${entry.name}`,
                sha: entry.oid,
                text: entry.object?.text || ''
            }));
        } catch (error) {
            console.warn('GraphQL fetch failed:', error);
            throw error;
        }
    }

    // Jekyll 설정 헬퍼
    getJekyllConfig() {
        return `title: ${this.username}'s Wiki
description: Personal knowledge base powered by Miki Editor
theme: minima
plugins:
  - jekyll-feed
  - jekyll-seo-tag

# Build settings
markdown: kramdown
permalink: /:year/:month/:day/:title/
`;
    }

    getIndexPage() {
        return `---
layout: home
title: Home
---

# Welcome to My Wiki

This is my personal knowledge base, powered by [Miki Editor](https://miki-editor.com).

## Recent Posts
`;
    }

    getWelcomePost() {
        const today = this.getTodayDate();
        return `---
layout: post
title: "Welcome to Miki Editor"
date: ${today}
categories: meta
---

This is your first post created by Miki Editor!

You can:
- Write in Markdown
- Auto-save to GitHub
- Publish to your blog
- Create bidirectional links

Happy writing! 🎉
`;
    }

    /**
     * 첨부파일 업로드 (Issues CDN 우선, Repository Fallback)
     * @param {File} file - 업로드할 이미지 파일
     * @param {string} repoPath - 저장소 경로 (Fallback용)
     * @returns {Object} - { repoUrl, cdnUrl, issuesCdnUrl, displayUrl }
     */
    async uploadToAttachments(file, repoPath) {
        // Issues CDN 우선 시도 (저장소 용량 0 사용)
        try {
            const issuesCdnUrl = await this.uploadToIssuesCDN(file);
            return {
                repoUrl: null,
                cdnUrl: issuesCdnUrl,
                issuesCdnUrl: issuesCdnUrl,
                displayUrl: issuesCdnUrl
            };
        } catch (error) {
            // SessionExpiredError는 상위로 전파 (사용자 처리)
            if (error instanceof SessionExpiredError) {
                throw error;
            }

            // 기타 에러: Repository Fallback
            console.warn('Issues CDN 실패, Repository 업로드로 전환:', error.message);

            const base64Content = await this.fileToBase64(file);
            await this.createOrUpdateFile(
                'miki-data',
                repoPath,
                base64Content,
                `Add attachment: ${file.name}`,
                null,
                { skipShaLookup: false }
            );

            const cdnUrl = `https://cdn.jsdelivr.net/gh/${this.username}/miki-data@main/${repoPath}`;
            return {
                repoUrl: `https://raw.githubusercontent.com/${this.username}/miki-data/main/${repoPath}`,
                cdnUrl: cdnUrl,
                issuesCdnUrl: null,
                displayUrl: cdnUrl
            };
        }
    }

    /**
     * GitHub Issues CDN 업로드 (3단계 프로세스)
     * @param {File} file - 업로드할 파일
     * @returns {string} - Issues CDN URL (https://github.com/user-attachments/assets/{uuid})
     */
    async uploadToIssuesCDN(file) {
        // 1단계: 업로드 정책 요청
        const policyResp = await fetch('https://github.com/upload/policies/assets', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'GitHub-Verified-Fetch': 'true',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                name: file.name,
                size: file.size,
                content_type: file.type
            })
        });

        if (policyResp.status === 401) {
            throw new SessionExpiredError('GitHub 세션이 만료되었습니다. github.com에서 로그인이 필요합니다.');
        }

        if (!policyResp.ok) {
            throw new Error(`Policy request failed: ${policyResp.status}`);
        }

        const policy = await policyResp.json();

        // 2단계: AWS S3 업로드
        const formData = new FormData();
        Object.entries(policy.form).forEach(([key, value]) => {
            formData.append(key, value);
        });
        formData.append('file', file);

        const s3Resp = await fetch(policy.upload_url, {
            method: 'POST',
            body: formData
        });

        if (!s3Resp.ok) {
            throw new Error('S3 upload failed');
        }

        // 3단계: 업로드 확정
        const finalResp = await fetch(policy.asset_upload_url, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'GitHub-Verified-Fetch': 'true',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!finalResp.ok) {
            throw new Error('Asset finalization failed');
        }

        const result = await finalResp.json();
        return result.asset.url; // https://github.com/user-attachments/assets/{uuid}
    }

    /**
     * File 객체를 Base64 문자열로 변환
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Data URL에서 Base64 부분만 추출 (data:image/png;base64, 제거)
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }
}
