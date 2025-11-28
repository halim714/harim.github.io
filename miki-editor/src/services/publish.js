import { AuthService } from './auth';
import { GitHubService } from './github';
import { prepareForPublish, generateFrontMatter } from './metadata';
import { parseFrontMatter } from '../utils/markdown';
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

        const slug = slugify(document.title);
        const date = new Date().toISOString().split('T')[0];
        const filename = `${date}-${slug}.md`;

        // 🟢 본문 정제 (Double Front Matter 방지)
        const { content: cleanBody } = parseFrontMatter(document.content || '');

        // 🟢 메타데이터 확정
        const originalPublishedAt = document.publishedAt || document.frontMatter?.publishedAt;
        const newPublishedAt = originalPublishedAt || new Date().toISOString();

        const finalDocumentState = {
            ...document,
            content: cleanBody,
            published: true,
            status: 'published',
            publishedAt: newPublishedAt,
            updatedAt: new Date().toISOString()
        };

        // 🟢 Public: 링크 변환 O
        const publicContent = prepareForPublish(finalDocumentState);

        // 🟢 Private: 링크 변환 X, 원본 보존
        const privateFrontMatter = generateFrontMatter(finalDocumentState);
        const privateContent = privateFrontMatter + '\n' + cleanBody;

        // 🟢 [변경] Private 파일명 결정 로직 개선
        // 1순위: storage-client가 확정한 filename (저장 시 생성됨)
        // 2순위: slug (fallback)
        let privateFilename = document.filename;
        if (!privateFilename) {
            privateFilename = slug;
        }

        // 확장자 중복 방지 및 경로 생성
        privateFilename = privateFilename.replace(/\.md$/, '');
        const privatePath = `miki-editor/posts/${privateFilename}.md`;

        const newPrivateSha = await this.github.createOrUpdateFile(
            'miki-data',
            privatePath,
            privateContent,
            `Publish: ${document.title} (Sync to Private)`,
            document.sha
        );

        // Public 저장
        const publicPath = `_posts/${filename}`;
        await this.github.createOrUpdateFile(
            `${this.username}.github.io`,
            publicPath,
            publicContent,
            `Publish: ${document.title}`
        );

        return {
            success: true,
            privateRepo: 'miki-data',
            publicRepo: `${this.username}.github.io`,
            publicPath,
            publicUrl: `https://${this.username}.github.io/${slug}`,
            estimatedDeployTime: '1-2 minutes',
            newSha: newPrivateSha,
            finalDocument: finalDocumentState
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
