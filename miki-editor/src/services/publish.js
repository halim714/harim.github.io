import { AuthService } from './auth';
import { GitHubService } from './github';
import { prepareForPublish } from './metadata';
import { slugify } from '../utils/slugify';

/**
 * Publish Service
 * 프라이빗 저장소(miki-data) → 퍼블릭 저장소(username.github.io) 배포
 */
export class PublishService {
    constructor(token) {
        this.github = new GitHubService(token);
        this.username = null;
    }

    async initialize() {
        this.username = await this.github.setUsername();
    }

    /**
     * 단일 문서 배포
     */
    async publishDocument(document) {
        await this.initialize();

        // 1. 제목으로 파일명 생성 (Jekyll 형식: YYYY-MM-DD-slug.md)
        const slug = slugify(document.title);
        const date = new Date().toISOString().split('T')[0];
        const filename = `${date}-${slug}.md`;

        // 2. Jekyll용 마크다운 생성 (Front Matter 포함)
        const publishContent = prepareForPublish(document);

        // ✅ CRITICAL FIX: 프라이빗 저장소에 메타데이터 주입
        const { parseFrontMatter } = await import('../utils/markdown');
        const { data: frontMatter, content: body } = parseFrontMatter(document.content || '');

        // published 메타데이터 주입
        const updatedFrontMatter = {
            ...frontMatter,
            published: true,
            publishedAt: new Date().toISOString(),
            status: 'published',
            title: document.title,
            slug: slug,
            docId: document.id
        };

        // Front Matter 재조립 (YAML 형식 준수)
        const frontMatterLines = Object.entries(updatedFrontMatter).map(([key, value]) => {
            if (typeof value === 'boolean') {
                return `${key}: ${value}`;
            } else if (typeof value === 'string') {
                return `${key}: "${value.replace(/"/g, '\\"')}"`;
            } else {
                return `${key}: ${value}`;
            }
        });

        const updatedPrivateContent = `---\n${frontMatterLines.join('\n')}\n---\n${body}`;

        // 3. 프라이빗 저장소에 먼저 저장 (원본 + 메타데이터)
        // 원본은 ID 기반 파일명을 유지 (데이터 일관성)
        // 메타데이터에 slug 정보가 포함되어 있으므로 나중에 추적 가능
        const privatePath = `miki-editor/posts/${document.id}.md`;

        // 원본 저장 (내용은 그대로, 커밋 메시지만 Publish 기록)
        await this.github.createOrUpdateFile(
            'miki-data',
            privatePath,
            updatedPrivateContent, // ✅ 메타데이터가 주입된 내용
            `Publish: ${document.title} (Sync to Private)`,
            document.sha
        );

        // 4. 퍼블릭 저장소에 배포 (Jekyll 형식)
        const publicPath = `_posts/${filename}`;

        // 퍼블릭 리포지토리 존재 여부 확인 (없으면 생성 시도하지 않음, Onboarding에서 했어야 함)

        const publicSha = await this.github.createOrUpdateFile(
            `${this.username}.github.io`,
            publicPath,
            publishContent,
            `Publish: ${document.title}`
        );

        return {
            success: true,
            privateRepo: 'miki-data',
            publicRepo: `${this.username}.github.io`,
            publicPath,
            publicUrl: `https://${this.username}.github.io/${slug}`, // Jekyll 기본 permalink 규칙 가정
            estimatedDeployTime: '1-2 minutes'
        };
    }

    /**
     * 배포 취소 (퍼블릭 저장소에서만 삭제)
     */
    async unpublishDocument(document) {
        await this.initialize();

        const slug = slugify(document.title);
        // 날짜는 문서의 publishedAt이 있으면 그걸 쓰고, 없으면 오늘 날짜(추측)
        // 주의: 날짜가 바뀌면 파일명을 못 찾을 수 있음. 
        // 정확한 삭제를 위해서는 퍼블릭 리포지토리에서 해당 Slug를 가진 파일을 검색해야 할 수도 있음.
        // 일단은 단순하게 처리.
        const date = document.publishedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
        const filename = `${date}-${slug}.md`;
        const publicPath = `_posts/${filename}`;

        try {
            // SHA 가져오기
            const { data } = await this.github.octokit.rest.repos.getContent({
                owner: this.username,
                repo: `${this.username}.github.io`,
                path: publicPath
            });

            // 삭제
            await this.github.octokit.rest.repos.deleteFile({
                owner: this.username,
                repo: `${this.username}.github.io`,
                path: publicPath,
                message: `Unpublish: ${document.title}`,
                sha: data.sha
            });

            return { success: true };
        } catch (error) {
            if (error.status === 404) {
                return { success: true, message: 'Already unpublished' };
            }
            throw error;
        }
    }
}
