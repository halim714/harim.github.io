import { createLogger } from '../utils/logger';
const logger = createLogger('httpAdapter');
/**
 * HttpAdapter - REST API 통신 어댑터
 */
export class HttpAdapter {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:3003/api';
    this.timeout = options.timeout || 10000;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
  }
  
  /**
   * HTTP 요청 공통 처리
   */
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method,
      headers: { ...this.headers, ...options.headers },
      signal: AbortSignal.timeout(this.timeout),
      ...options
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }
    
    try {
      logger.info(`🌐 ${method} ${url}`, data ? { data } : '');
      
      const response = await fetch(url, config);
      
      // ETag 헤더 처리 (캐시 무결성)
      const etag = response.headers.get('ETag');
      const lastModified = response.headers.get('Last-Modified');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }
      
      const result = await response.json();
      
      // 메타데이터 추가
      if (etag || lastModified) {
        result._meta = {
          etag,
          lastModified,
          status: response.status
        };
      }
      
      logger.info(`✅ ${method} ${url} 성공`, { status: response.status });
      return result;
      
    } catch (error) {
      logger.error(`❌ ${method} ${url} 실패:`, error.message);
      
      // 네트워크 오류 표준화
      if (error.name === 'AbortError') {
        const timeoutError = new Error('요청 시간 초과');
        timeoutError.name = 'TimeoutError';
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error('네트워크 연결 실패');
        networkError.name = 'NetworkError';
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      
      throw error;
    }
  }
  
  /**
   * 문서 생성
   */
  async createDocument(data) {
    return await this.request('POST', '/posts', {
      title: data.title || '제목 없음',
      content: data.content || '',
      ...data
    });
  }
  
  /**
   * 문서 조회
   */
  async getDocument(id) {
    return await this.request('GET', `/posts/${id}`);
  }
  
  /**
   * 문서 업데이트 (ETag 기반 충돌 감지)
   */
  async updateDocument(id, data, options = {}) {
    const headers = {};
    
    // ETag 기반 조건부 업데이트
    if (data._meta?.etag) {
      headers['If-Match'] = data._meta.etag;
    }
    
    // Last-Modified 기반 조건부 업데이트
    if (data._meta?.lastModified) {
      headers['If-Unmodified-Since'] = data._meta.lastModified;
    }
    
    return await this.request('PUT', `/posts/${id}`, {
      title: data.title,
      content: data.content,
      updatedAt: data.updatedAt || new Date().toISOString(),
      ...data
    }, { headers });
  }
  
  /**
   * 문서 삭제
   */
  async deleteDocument(id) {
    return await this.request('DELETE', `/posts/${id}`);
  }
  
  /**
   * 문서 목록 조회
   */
  async getDocuments(options = {}) {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    if (options.search) params.append('search', options.search);
    if (options.since) params.append('since', options.since);
    
    const query = params.toString();
    const endpoint = query ? `/posts?${query}` : '/posts';
    
    return await this.request('GET', endpoint);
  }
  
  /**
   * 서버 상태 확인
   */
  async healthCheck() {
    try {
      const result = await this.request('GET', '/health', null, { 
        timeout: 5000 
      });
      return { status: 'ok', ...result };
    } catch (error) {
      return { 
        status: 'error', 
        error: error.message,
        code: error.code 
      };
    }
  }
  
  /**
   * 동기화 상태 조회
   */
  async getSyncStatus(documentIds = []) {
    if (documentIds.length === 0) {
      return await this.request('GET', '/sync/status');
    }
    
    return await this.request('POST', '/sync/status', {
      documentIds
    });
  }
  
  /**
   * 배치 업데이트 (여러 문서 한번에)
   */
  async batchUpdate(documents) {
    return await this.request('POST', '/posts/batch', {
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        updatedAt: doc.updatedAt
      }))
    });
  }
  
  /**
   * 충돌 해결을 위한 서버 데이터 조회
   */
  async getDocumentRevision(id, revision) {
    return await this.request('GET', `/posts/${id}/revisions/${revision}`);
  }
  
  /**
   * 검색
   */
  async searchDocuments(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: options.limit || 20,
      offset: options.offset || 0
    });
    
    if (options.fields) {
      params.append('fields', options.fields.join(','));
    }
    
    return await this.request('GET', `/search?${params.toString()}`);
  }
}

/**
 * HTTP 어댑터 팩토리
 */
export const createHttpAdapter = (options = {}) => {
  return new HttpAdapter(options);
};

/**
 * 기본 HTTP 어댑터 인스턴스
 */
export const defaultHttpAdapter = new HttpAdapter(); 