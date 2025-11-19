/**
 * Extracts a title from markdown content.
 * Mirrors the logic from the original server.js implementation.
 * @param {string} content - The markdown content of the post.
 * @returns {string} The extracted title.
 */
function extractTitleFromContent(content) {
  if (!content || content.trim() === '') return 'New memo';

  // First search for # header
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // If no # header, use first line (50 character limit)
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() || '';

  if (firstLine === '') {
    return 'New memo';
  }

  // Remove markdown formatting and limit to 50 characters
  const cleanTitle = firstLine
    .replace(/^#+\s*/, '') // Remove header marker
    .replace(/\*\*(.*?)\*\*/g, '') // Remove bold
    .replace(/\*(.*?)\*/g, '') // Remove italic
    .replace(/`(.*?)`/g, '') // Remove inline code
    .replace(/\[(.*?)\]\(.*?\)/g, '') // Remove link
    .trim()
    .slice(0, 50); // Limit to 50 characters

  return cleanTitle || 'New memo';
}

/**
 * Sanitizes a string to be used as a file name.
 * @param {string} input - The string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitizeForFileName(input) {
  return String(input || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = {
  extractTitleFromContent,
  sanitizeForFileName,
};