const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const storage = require('./server/storage');
const { extractTitleFromContent, sanitizeForFileName } = require('./server/utils');

// Load environment variables - prefer server-local secrets
dotenv.config({ path: path.resolve(__dirname, '.server.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3003;
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Posts directory path (editor local)
const POSTS_DIR = path.join(__dirname, 'posts');
// Wiki paths (configurable via .env)
const WIKI_PATH = process.env.WIKI_PATH || path.resolve(__dirname, '../miki-wiki');
const WIKI_POSTS = process.env.WIKI_POSTS || '_posts';
const WIKI_HISTORY = process.env.WIKI_HISTORY || 'history';

// === Helper utilities ===
const LOCK_FILE = '.miki-lock';



const matter = require('gray-matter');
const yaml = require('js-yaml');

// ... (other requires and setup)

// Publish to miki-wiki: copy current post to _posts and history, then git commit/push
app.post('/api/publish', async (req, res) => {
  // 1. Environment Variable Validation
  const { DATA_REPO_OWNER, DATA_REPO_NAME, PAGES_REPO_OWNER, PAGES_REPO_NAME } = process.env;
  if (!DATA_REPO_OWNER || !DATA_REPO_NAME || !PAGES_REPO_OWNER || !PAGES_REPO_NAME) {
    return res.status(500).json({
      error: 'Server configuration incomplete. Repository settings are missing.',
      details: 'Required environment variables: DATA_REPO_OWNER, DATA_REPO_NAME, PAGES_REPO_OWNER, PAGES_REPO_NAME'
    });
  }

  const { id, action = 'publish' } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing document id' });
  }

  try {
    // 2. Handle 'unpublish' action
    if (action === 'unpublish') {
      const existingPageData = await storage.findAndGetPostByDocId(id, {
        owner: PAGES_REPO_OWNER,
        repo: PAGES_REPO_NAME,
      });

      if (!existingPageData) {
        return res.json({ success: true, message: 'Already unpublished', wasPublished: false });
      }

      await storage.deletePost(existingPageData.filename, existingPageData.sha, {
        owner: PAGES_REPO_OWNER,
        repo: PAGES_REPO_NAME,
        postsPath: '_posts',
      });

      return res.json({ success: true, message: 'Unpublished successfully', wasPublished: true });
    }

    // 3. Handle 'publish' action
    if (action === 'publish') {
      // 3.1. Read original post from DATA_REPO
      const originalPost = await storage.getPost(`${id}.md`);
      if (!originalPost) {
        return res.status(404).json({ error: `Document with id ${id} not found in data repository.` });
      }

      // 3.2. Find existing post in PAGES_REPO (1 API call)
      const existingPageData = await storage.findAndGetPostByDocId(id, {
        owner: PAGES_REPO_OWNER,
        repo: PAGES_REPO_NAME,
      });

      // 3.3. Determine metadata
      const fallbackTitle = extractTitleFromContent(originalPost.content) || 'untitled';
      const title = originalPost.frontMatter.title || fallbackTitle;
      const postFileName = existingPageData?.filename || `${new Date().toISOString().slice(0, 10)}-${sanitizeForFileName(title)}.md`;
      const finalCreatedAt = existingPageData?.frontMatter.createdAt || originalPost.frontMatter.createdAt || new Date().toISOString();
      const pagesSha = existingPageData?.sha || null;

      // 3.4. Construct final Front Matter
      const finalFrontMatter = {
        docId: id,
        title: title,
        titleMode: originalPost.frontMatter.titleMode || 'auto',
        createdAt: finalCreatedAt,
        updatedAt: new Date().toISOString(),
        permalink: `/doc/${id}/`,
      };

      // 3.5. Create final content safely
      const finalContent = matter.stringify(originalPost.content, finalFrontMatter);

      // 3.6. Write to PAGES_REPO
      await storage.updatePost(postFileName, finalContent, pagesSha, {
        owner: PAGES_REPO_OWNER,
        repo: PAGES_REPO_NAME,
        postsPath: '_posts',
      });

      return res.json({ success: true, message: 'Published successfully' });
    }

    // 4. Handle invalid action
    return res.status(400).json({
      error: `Invalid action: ${action}. Expected 'publish' or 'unpublish'.`
    });

  } catch (error) {
    console.error(`Publish error for docId "${id}":`, error);
    res.status(500).json({
      error: 'Publish failed',
      details: error.message,
    });
  }
});

// Get post list
app.get('/api/posts', async (req, res) => {
  try {
    const postList = await storage.getPostList();
    res.json(postList);
  } catch (error) {
    console.error('Post list retrieval error:', error);
    res.status(500).json({ error: 'Error retrieving post list' });
  }
});

// Get post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const postData = await storage.getPost(`${id}.md`);

    const { frontMatter, content } = postData;

    // Use front matter data, with fallbacks for robustness
    const title = frontMatter.title || extractTitleFromContent(content);
    const titleMode = frontMatter.titleMode || 'auto';
    const createdAt = frontMatter.createdAt ? new Date(frontMatter.createdAt) : new Date();
    const updatedAt = frontMatter.updatedAt ? new Date(frontMatter.updatedAt) : new Date();

    console.log(`📖 Document loaded: ${id} | Title: ${title} | Mode: ${titleMode}`);

    res.json({
      id,
      title,
      titleMode,
      content,
      updatedAt,
      createdAt,
    });
  } catch (error) {
    console.error(`Post retrieval error (ID: ${req.params.id}):`, error);
    res.status(404).json({ error: 'Post not found' });
  }
});

// Save post
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, titleMode = 'manual' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Generate initial ID from title
    let id = title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 
      `post-${Date.now()}`;
    
    // Step 1 (Check Existence): Check if a post with this ID already exists on GitHub
    try {
      await storage.getPost(`${id}.md`);
      // If getPost succeeds, the file exists. Generate a new ID.
      console.log(`📝 [POST-API] Post with id "${id}" already exists. Generating new ID.`);
      id = `${id}-${Date.now()}`;
    } catch (error) {
      // If getPost fails (throws an error, likely 404), the file does not exist.
      // We can proceed with the original ID.
      console.log(`📝 [POST-API] Post with id "${id}" does not exist. Creating new post.`);
    }

    // Step 2 (Prepare): Construct the new content and front matter
    const now = new Date().toISOString();
    const frontMatter = `---
docId: "${id}"
title: "${title}"
titleMode: "${titleMode}"
createdAt: "${now}"
updatedAt: "${now}"
permalink: "/doc/${id}/"
---
`;
    const fullContent = frontMatter + content;
    
    // Step 3 (Write): Create the new post in GitHub (sha is null)
    await storage.updatePost(`${id}.md`, fullContent, null);

    console.log(`✅ New document created: ${id} | Title: ${title} | Mode: ${titleMode}`);
    res.status(201).json({ id, title, titleMode, success: true });

  } catch (error) {
    console.error('Post saving error:', error);
    res.status(500).json({ error: 'Error saving post' });
  }
});

// Update post
app.put('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content = '', title, titleMode = 'auto' } = req.body;

    // Step 1 (Read): Get current post data to retrieve SHA and preserve createdAt
    let existingSha = null;
    let existingCreatedAt = new Date().toISOString();
    try {
      const existingPost = await storage.getPost(`${id}.md`);
      console.log('[DEBUG] Existing Post Data:', existingPost); // DEBUG LOG
      existingSha = existingPost.sha;
      if (existingPost.frontMatter.createdAt) {
        existingCreatedAt = new Date(existingPost.frontMatter.createdAt).toISOString();
      }
    } catch (error) {
      // If post doesn't exist, it will be created. sha remains null.
      console.log(`📝 [PUT-API] No existing post found for "${id}". A new post will be created.`);
    }
    console.log('[DEBUG] Existing SHA:', existingSha); // DEBUG LOG

    // Step 2 (Prepare): Construct the new content and front matter
    let finalTitle = title;
    let finalTitleMode = titleMode;
    if (!title || title.trim() === '') {
      finalTitle = extractTitleFromContent(content);
      finalTitleMode = 'auto';
    } else {
      finalTitleMode = titleMode || 'manual';
    }

    const now = new Date().toISOString();
    const frontMatter = `---
docId: "${id}"
title: "${finalTitle}"
titleMode: "${finalTitleMode}"
createdAt: "${existingCreatedAt}"
updatedAt: "${now}"
permalink: "/doc/${id}/"
---
`;
    const fullContent = frontMatter + content;
    console.log('[DEBUG] Full Content to be sent:', fullContent); // DEBUG LOG

    // Step 3 (Write): Update the post in GitHub
    const updateResponse = await storage.updatePost(`${id}.md`, fullContent, existingSha);
    console.log('[DEBUG] GitHub Update Response:', updateResponse); // DEBUG LOG

    console.log(`✅ [PUT-API] Document saved: ${id} | Title: ${finalTitle} | Mode: ${finalTitleMode}`);
    
    res.json({ 
      id, 
      title: finalTitle,
      titleMode: finalTitleMode,
      success: true 
    });
  } catch (error) {
    console.error(`❌ [PUT-API] Post update error (ID: ${req.params.id}):`, error);
    res.status(500).json({ error: 'Error updating post' });
  }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Step 1 (Read): Get current post data to retrieve SHA
    let existingSha = null;
    try {
      const existingPost = await storage.getPost(`${id}.md`);
      existingSha = existingPost.sha;
    } catch (error) {
      // If getPost fails, the file likely doesn't exist on GitHub.
      // We can consider the deletion successful.
      console.log(`📝 [DELETE-API] Post with id "${id}" not found on GitHub. Assuming already deleted.`);
      return res.json({ success: true });
    }

    // Step 2 (Delete): Delete the post from GitHub
    await storage.deletePost(`${id}.md`, existingSha);

    res.json({ success: true });
  } catch (error) {
    console.error(`Post deletion error (ID: ${req.params.id}):`, error);
    res.status(500).json({ error: 'Error deleting post' });
  }
});

// Delete wiki post by docId (keeps history)
app.delete('/api/wiki/doc/:id', async (req, res) => {
  const { id } = req.params || {};
  if (!id) return res.status(400).json({ error: 'Missing document id' });
  try {
    const file = await findWikiPostFileByDocId(id);
    if (!file) return res.json({ success: true, message: 'No wiki post for this docId' });
    const target = path.join(WIKI_PATH, WIKI_POSTS, file);
    await fs.unlink(target);

    try {
      await acquireWikiLock();
      await execAsync('git add .', { cwd: WIKI_PATH });
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: WIKI_PATH });
      if ((stdout || '').trim()) {
        await execAsync('git -c user.name="Miki Editor" -c user.email="miki@example.com" commit -m "remove(doc): ' + id + '"', { cwd: WIKI_PATH });
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
          const pushUrl = `https://${encodeURIComponent(process.env.GITHUB_USER || 'oauth2')}:${encodeURIComponent(process.env.GITHUB_TOKEN)}@github.com/${process.env.GITHUB_REPO}.git`;
          let branch = (process.env.WIKI_BRANCH || 'main');
          await execAsync(`git push "${pushUrl}" HEAD:${branch}`, { cwd: WIKI_PATH });
        } else {
          await execAsync('git push', { cwd: WIKI_PATH });
        }
      }
      await releaseWikiLock();
    } catch (e) {
      await releaseWikiLock();
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Wiki deletion failed:', e.message || e);
    res.status(500).json({ error: 'Wiki deletion failed' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`API endpoint: http://localhost:${port}/api/claude`);
  console.log(`Posts management API: http://localhost:${port}/api/posts`);
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`API 엔드포인트: http://localhost:${port}/api/claude`);
  console.log(`글 관리 API: http://localhost:${port}/api/posts`);
}); 