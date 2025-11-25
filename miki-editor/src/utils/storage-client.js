// src/utils/storage-client.js

// OAuth 모드: 서버 API 호출
export const storage = {
  async getPostList() {
    const res = await fetch('/api/posts', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json();
  },

  async getPost(id) {
    const res = await fetch(`/api/posts/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch post: ${id}`);
    return res.json();
  },

  async savePost(post) {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to save post');
    return res.json();
  },
  
  async updatePost(id, post) {
    const res = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
        credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to update post: ${id}`);
    return res.json();
  },

  async deletePost(id) {
    const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to delete post: ${id}`);
    return res.json();
  }
};