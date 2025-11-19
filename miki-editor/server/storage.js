const { Octokit } = require("octokit");
const matter = require('gray-matter');
require('dotenv').config();
const { extractTitleFromContent } = require('./utils');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Fetches the list of posts from a GitHub repository using GraphQL.
 * @param {object} options - Optional parameters.
 * @param {string} [options.owner] - The repository owner.
 * @param {string} [options.repo] - The repository name.
 * @param {string} [options.postsPath] - The path to the posts directory.
 * @returns {Promise<Array<Object>>} A list of post metadata.
 */
async function getPostList(options = {}) {
  const {
    owner = process.env.DATA_REPO_OWNER,
    repo = process.env.DATA_REPO_NAME,
    postsPath = 'miki-editor/posts'
  } = options;

  try {
    const graphqlQuery = `
      query getPosts($owner: String!, $repo: String!, $expression: String!) {
        repository(owner: $owner, name: $repo) {
          object(expression: $expression) {
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
      expression: `HEAD:${postsPath}`,
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
 * @param {string} fileName - The file name of the post (e.g., 'my-post.md').
 * @param {object} options - Optional parameters.
 * @param {string} [options.owner] - The repository owner.
 * @param {string} [options.repo] - The repository name.
 * @param {string} [options.postsPath] - The path to the posts directory.
 * @returns {Promise<Object>} An object with post data, content, and front matter.
 */
async function getPost(fileName, options = {}) {
  const {
    owner = process.env.DATA_REPO_OWNER,
    repo = process.env.DATA_REPO_NAME,
    postsPath = 'miki-editor/posts'
  } = options;

  try {
    const { data: file } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `${postsPath}/${fileName}`,
    });

    const rawContent = Buffer.from(file.content, 'base64').toString('utf8');
    const { data: frontMatter, content: body } = matter(rawContent);

    return {
      id: file.name,
      sha: file.sha,
      frontMatter,
      content: body,
      rawContent: rawContent, // Added rawContent property
    };
  } catch (error) {
    console.error(`Error fetching post "${fileName}" from GitHub:`, error);
    throw new Error(`Could not fetch post "${fileName}".`);
  }
}

/**
 * Creates or updates a post in a GitHub repository.
 * @param {string} fileName - The file name of the post.
 * @param {string} content - The full markdown content (including front matter).
 * @param {string|null} sha - The blob SHA of the file. Required for updates, null for new files.
 * @param {object} options - Optional parameters.
 * @param {string} [options.owner] - The repository owner.
 * @param {string} [options.repo] - The repository name.
 * @param {string} [options.postsPath] - The path to the posts directory.
 * @returns {Promise<Object>} The result from the GitHub API.
 */
async function updatePost(fileName, content, sha, options = {}) {
  const {
    owner = process.env.DATA_REPO_OWNER,
    repo = process.env.DATA_REPO_NAME,
    postsPath = 'miki-editor/posts'
  } = options;

  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `${postsPath}/${fileName}`,
      message: `docs: update ${fileName}`,
      content: Buffer.from(content).toString('base64'),
      sha,
    });
    return data;
  } catch (error) {
    console.error(`Error updating post "${fileName}" in GitHub:`, error);
    throw new Error(`Could not update post "${fileName}".`);
  }
}

/**
 * Deletes a post from a GitHub repository.
 * @param {string} fileName - The file name of the post to delete.
 * @param {string} sha - The blob SHA of the file to be deleted.
 * @param {object} options - Optional parameters.
 * @param {string} [options.owner] - The repository owner.
 * @param {string} [options.repo] - The repository name.
 * @param {string} [options.postsPath] - The path to the posts directory.
 * @returns {Promise<Object>} The result from the GitHub API.
 */
async function deletePost(fileName, sha, options = {}) {
  const {
    owner = process.env.DATA_REPO_OWNER,
    repo = process.env.DATA_REPO_NAME,
    postsPath = 'miki-editor/posts'
  } = options;

  if (!sha) {
    throw new Error('SHA is required to delete a file.');
  }
  try {
    const { data } = await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: `${postsPath}/${fileName}`,
      message: `docs: delete ${fileName}`,
      sha,
    });
    return data;
  } catch (error) {
    console.error(`Error deleting post "${fileName}" in GitHub:`, error);
    throw new Error(`Could not delete post "${fileName}".`);
  }
}

/**
 * Finds a post by its docId in a specific repository path and returns its data.
 * @param {string} docId - The docId to search for.
 * @param {object} options - Optional parameters.
 * @param {string} [options.owner] - The repository owner.
 * @param {string} [options.repo] - The repository name.
 * @param {string} [options.postsPath] - The path to search in.
 * @returns {Promise<Object|null>} The post data if found, otherwise null.
 */
async function findAndGetPostByDocId(docId, options = {}) {
  const {
    owner = process.env.DATA_REPO_OWNER,
    repo = process.env.DATA_REPO_NAME,
    postsPath = '_posts'
  } = options;

  try {
    const query = `
      query($owner: String!, $repo: String!, $expression: String!) {
        repository(owner: $owner, name: $repo) {
          object(expression: $expression) {
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

    const result = await octokit.graphql(query, {
      owner,
      repo,
      expression: `HEAD:${postsPath}`
    });

    if (!result.repository.object || !result.repository.object.entries) {
      return null;
    }

    for (const entry of result.repository.object.entries) {
      if (entry.name.endsWith('.md') && entry.object && typeof entry.object.text === 'string') {
        const { data: frontMatter, content } = matter(entry.object.text);
        if (frontMatter.docId === docId) {
          return {
            filename: entry.name,
            sha: entry.oid,
            frontMatter,
            content,
            rawContent: entry.object.text
          };
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`Error in findAndGetPostByDocId for docId "${docId}":`, error);
    // If the directory doesn't exist, it's not a critical error, just means no post.
    if (error.name === 'GraphqlResponseError' && error.errors?.[0]?.type === 'NOT_FOUND') {
      return null;
    }
    throw error; // Re-throw other errors
  }
}

module.exports = {
  getPostList,
  getPost,
  updatePost,
  deletePost,
  findAndGetPostByDocId,
};