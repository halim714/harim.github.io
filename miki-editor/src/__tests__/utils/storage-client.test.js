import { storage } from '../../utils/storage-client';
import { AuthService } from '../../services/auth';
import { GitHubService } from '../../services/github';

// Mock octokit to avoid ESM issues
jest.mock('octokit', () => ({
    Octokit: class MockOctokit { }
}));

// Mock dependencies
jest.mock('../../services/auth');
jest.mock('../../services/github');

describe('storage-client', () => {
    // Define mock instance outside beforeEach to keep reference stable across tests
    // because storage-client caches the instance
    const mockGithubInstance = {
        getFilesWithMetadata: jest.fn(),
        getFile: jest.fn(),
        createOrUpdateFile: jest.fn(),
        deleteFile: jest.fn(),
        setUsername: jest.fn().mockResolvedValue('testuser')
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock AuthService to return a token
        AuthService.getToken.mockReturnValue('mock-token');

        // Mock GitHubService constructor to return our stable mock instance
        GitHubService.mockImplementation(() => mockGithubInstance);
    });

    describe('getPost', () => {
        it('should strip frontmatter from content and return it separately', async () => {
            // Arrange
            const docId = 'test-doc-id';
            const rawContent = `---
docId: "${docId}"
title: "Test Document"
date: 2023-01-01
tags: ["test", "mock"]
---
# Hello World

This is the body content.`;

            // Mock getPostList to return a file entry so getPost can find the filename
            mockGithubInstance.getFilesWithMetadata.mockResolvedValue([
                { name: 'test-doc.md', text: rawContent, path: 'miki-editor/posts/test-doc.md' }
            ]);

            // Mock getFile to return the raw content
            mockGithubInstance.getFile.mockResolvedValue({
                content: Buffer.from(rawContent).toString('base64'),
                sha: 'mock-sha'
            });

            // Act
            const result = await storage.getPost(docId);

            // Assert
            expect(result.id).toBe(docId);
            expect(result.title).toBe('Test Document');
            // Content should NOT contain frontmatter
            expect(result.content).not.toContain('---');
            expect(result.content).not.toContain('title: "Test Document"');
            expect(result.content).toContain('# Hello World');
            expect(result.content.trim()).toBe('# Hello World\n\nThis is the body content.');

            // Frontmatter should be preserved in a separate property
            expect(result.frontMatter).toBeDefined();
            expect(result.frontMatter.title).toBe('Test Document');
            expect(result.frontMatter.tags).toEqual(['test', 'mock']);
        });
    });

    describe('savePost', () => {
        it('should merge preserved frontmatter with new content when saving', async () => {
            // Arrange
            const docId = 'test-doc-id';
            const originalFrontMatter = {
                docId: docId,
                title: 'Original Title',
                tags: ['preserved-tag'],
                customField: 'preserved-value',
                createdAt: '2023-01-01T00:00:00.000Z'
            };

            const postToSave = {
                id: docId,
                title: 'New Title',
                content: '# New Content',
                frontMatter: originalFrontMatter
            };

            // Mock getPostList to simulate existing file
            mockGithubInstance.getFilesWithMetadata.mockResolvedValue([
                {
                    name: 'test-doc.md',
                    text: '---\ndocId: "test-doc-id"\n---\n# Old Content',
                    path: 'miki-editor/posts/test-doc.md'
                }
            ]);

            mockGithubInstance.createOrUpdateFile.mockResolvedValue('new-sha');

            // Act
            await storage.savePost(postToSave);

            // Assert
            expect(mockGithubInstance.createOrUpdateFile).toHaveBeenCalled();
            const [repo, path, content, message] = mockGithubInstance.createOrUpdateFile.mock.calls[0];

            // Verify content has frontmatter merged correctly
            expect(content).toContain('---');
            // Title might be quoted or unquoted depending on js-yaml behavior
            const titleMatch = content.includes('title: "New Title"') || content.includes('title: New Title');
            expect(titleMatch).toBe(true);
            expect(content).toContain('preserved-tag'); // Preserved tag (format varies)
            expect(content).toContain('customField: preserved-value'); // Preserved custom field
            expect(content).toContain('# New Content'); // New body
        });
    });
});
