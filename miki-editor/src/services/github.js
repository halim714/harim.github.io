import { Octokit } from 'octokit';

/**
 * GitHub Service
 * 기존 server/onboarding.js를 프론트엔드로 이동
 * 100% 동일한 로직 (검증 완료)
 */
export class GitHubService {
    constructor(token) {
        this.octokit = new Octokit({ auth: token });
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

        // 🔧 GitHub API 전파 대기 (레포 생성 직후 파일 접근 시 404 방지)
        await this.delay(3000);

        // 3. Jekyll 설정 (재시도 포함)
        await this.retryOperation(() => this.setupJekyll(pagesRepo), 3);

        // 4. GitHub Pages 활성화
        await this.enablePages(pagesRepo);

        // 5. 초기 구조 생성 (재시도 포함)
        await this.retryOperation(() => this.createInitialStructure(dataRepo), 3);

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
     * Jekyll 설정 (안전 모드: 이미 존재하면 건너뜀)
     */
    async setupJekyll(repo) {
        const files = [
            { path: '_config.yml', content: this.getJekyllConfig() },
            { path: 'index.md', content: this.getIndexPage() },
            { path: `_posts/${this.getTodayDate()}-welcome.md`, content: this.getWelcomePost() }
        ];

        for (const file of files) {
            // 파일 존재 여부 확인
            try {
                await this.getFile(repo.name, file.path);
                console.log(`Skipping ${file.path} (already exists)`);
            } catch (error) {
                // 404면 생성 진행
                if (error.message.includes('Expected a file') || error.status === 404 || error.message.includes('Not Found')) {
                    await this.createOrUpdateFile(repo.name, file.path, file.content, `Setup: ${file.path}`);
                } else {
                    throw error;
                }
            }
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
     * 초기 디렉토리 구조 생성 (안전 모드)
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
            if (error.status !== 422) throw error; // 422 외 에러만 throw
        }

        // README는 존재하면 건너뜀
        try {
            await this.getFile(repo.name, 'README.md');
        } catch (error) {
            await this.createOrUpdateFile(repo.name, 'README.md', readme, 'Add README');
        }
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
    async createOrUpdateFile(repoName, path, content, message, sha = null) {
        let currentSha = sha;

        // SHA가 없으면 조회 시도
        if (!currentSha) {
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

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }
}
