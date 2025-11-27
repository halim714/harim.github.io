const { Octokit } = require("octokit");
const matter = require('gray-matter');
require('dotenv').config();
const { extractTitleFromContent } = require('./utils'); // Import from shared utils

// =================================================================
// GitHub API Configuration
// =================================================================
// ... (rest of the configuration comments)

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const postsPath = 'miki-editor/posts'; // Or your target directory

/**
 * Fetches the list of posts from the GitHub repository using GraphQL.
 * @returns {Promise<Array<Object>>} A list of post metadata.
 */
async function getPostList() {
  try {
    const graphqlQuery = `
      query getPosts($owner: String!, $repo: String!, $postsPath: String!) {
        repository(owner: $owner, name: $repo) {
          object(expression: $postsPath) {
            ... on Tree {
              entries {
                name
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

    const { repository } = await octokit.graphql(graphqlQuery, {
      owner,
      repo,
      postsPath: `HEAD:${postsPath}`,
    });

    if (!repository || !repository.object || !repository.object.entries) {
      console.warn('GraphQL response for posts is empty or invalid.');
      return [];
    }

    const postList = [];
    for (const entry of repository.object.entries) {
      if (entry.name.endsWith('.md') && entry.object && typeof entry.object.text === 'string') {
        const rawContent = entry.object.text;
        const { data: frontMatter, content: body } = matter(rawContent);

        const title = frontMatter.title || extractTitleFromContent(body);
        const titleMode = frontMatter.titleMode || 'auto';
        const createdAt = frontMatter.createdAt ? new Date(frontMatter.createdAt) : new Date();
        const updatedAt = frontMatter.updatedAt ? new Date(frontMatter.updatedAt) : new Date();

        postList.push({
          id: entry.name.replace(/\.md$/, ''),
          title: title,
          titleMode: titleMode,
          filename: entry.name,
          createdAt: createdAt,
          updatedAt: updatedAt,
          size: rawContent.length,
          preview: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
        });
      }
    }

    postList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return postList;

  } catch (error) {
    console.error('Error fetching post list from GitHub with GraphQL:', error);
    if (error.name === 'GraphqlResponseError') {
      console.error('GraphQL Errors:', error.errors);
    }
    throw new Error('Could not fetch post list.');
  }
}

/**
 * Fetches a single post's content and front matter from GitHub.
 * @param {string} id - The file name of the post (e.g., 'my-post.md').
 * @returns {Promise<Object>} An object with post data, content, and front matter.
 */
async function getPost(id) {
  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `${postsPath}/${id}`,
    });

    const content = Buffer.from(file.content, 'base64').toString('utf8');
    const { data: frontMatter, content: body } = matter(content);

    return {
      id: file.name,
      sha: file.sha,
      frontMatter,
      content: body,
      rawContent: content,
    };
  } catch (error) {
    console.error(`Error fetching post "${id}" from GitHub:`, error);
    throw new Error(`Could not fetch post "${id}".`);
  }
}

/**
 * Creates or updates a post in the GitHub repository.
 * @param {string} id - The file name of the post.
 * @param {string} content - The full markdown content (including front matter).
 * @param {string} [sha] - The blob SHA of the file. Required for updates, not for new files.
 * @returns {Promise<Object>} The result from the GitHub API.
 */
async function updatePost(id, content, sha) {
  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `${postsPath}/${id}`,
      message: `docs: update ${id}`,
      content: Buffer.from(content).toString('base64'),
      sha, // If sha is provided, it's an update. If null/undefined, it's a create.
    });
    return data;
  } catch (error) {
    console.error(`Error updating post "${id}" in GitHub:`, error);
    throw new Error(`Could not update post "${id}".`);
  }
}

/**
 * Deletes a post from the GitHub repository.
 * @param {string} id - The file name of the post to delete.
 * @param {string} sha - The blob SHA of the file to be deleted.
 * @returns {Promise<Object>} The result from the GitHub API.
 */
async function deletePost(id, sha) {
  if (!sha) {
    throw new Error('SHA is required to delete a file.');
  }
  try {
    const { data } = await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: `${postsPath}/${id}`,
      message: `docs: delete ${id}`,
      sha,
    });
    return data;
  } catch (error) {
    console.error(`Error deleting post "${id}" in GitHub:`, error);
    throw new Error(`Could not delete post "${id}".`);
  }
}

module.exports = {
  getPostList,
  getPost,
  updatePost,
  deletePost,
};