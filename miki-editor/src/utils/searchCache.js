import { createLogger } from '../utils/logger';
const logger = createLogger('searchCache');
/**
 * 검색 결과 캐싱 및 관리를 위한 유틸리티 클래스
 * 메모리 및 로컬 스토리지를 활용하여 검색 결과 캐싱
 */

class SearchCache {
  constructor(options = {}) {
    this.memoryCache = new Map(); // 메모리 내 캐시
    this.localStoragePrefix = options.localStoragePrefix || 'miki_search_cache_';
    this.defaultTtl = options.defaultTtl || 1000 * 60 * 30; // 기본 TTL: 30분
    this.maxCacheSize = options.maxCacheSize || 100; // 최대 캐시 항목 수
    this.useLocalStorage = options.useLocalStorage !== false; // 로컬스토리지 사용 여부
    
    // 초기화 시 캐시 정리
    this.cleanup();
  }
  
  /**
   * 캐시에서 검색 결과 가져오기
   * @param {string} key - 캐시 키
   * @returns {Object|null} - 캐시된 결과 또는 null
   */
  get(key) {
    // 1. 메모리 캐시 확인
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && memoryItem.expiry > Date.now()) {
      logger.info(`[SearchCache] 메모리 캐시 히트: ${key}`);
      return memoryItem.value;
    }
    
    // 2. 메모리 캐시에 없거나 만료된 경우 로컬 스토리지 확인
    if (this.useLocalStorage) {
      try {
        const storageKey = this.localStoragePrefix + key;
        const storedItem = localStorage.getItem(storageKey);
        
        if (storedItem) {
          const item = JSON.parse(storedItem);
          
          // 만료 확인
          if (item.expiry > Date.now()) {
            logger.info(`[SearchCache] 로컬 스토리지 캐시 히트: ${key}`);
            
            // 메모리 캐시에도 추가
            this.memoryCache.set(key, {
              value: item.value,
              expiry: item.expiry
            });
            
            return item.value;
          } else {
            // 만료된 항목 제거
            localStorage.removeItem(storageKey);
          }
        }
      } catch (e) {
        logger.warn('[SearchCache] 로컬 스토리지 액세스 오류:', e);
      }
    }
    
    // 캐시 미스
    return null;
  }
  
  /**
   * 검색 결과를 캐시에 저장
   * @param {string} key - 캐시 키
   * @param {Object} value - 저장할 값
   * @param {number} ttl - 캐시 유효 시간(ms)
   */
  set(key, value, ttl = this.defaultTtl) {
    const expiry = Date.now() + ttl;
    
    // 1. 메모리 캐시에 저장
    this.memoryCache.set(key, {
      value,
      expiry
    });
    
    // 메모리 캐시 크기 제한
    if (this.memoryCache.size > this.maxCacheSize) {
      this.pruneMemoryCache();
    }
    
    // 2. 로컬 스토리지에 저장
    if (this.useLocalStorage) {
      try {
        const storageKey = this.localStoragePrefix + key;
        localStorage.setItem(storageKey, JSON.stringify({
          value,
          expiry
        }));
      } catch (e) {
        logger.warn('[SearchCache] 로컬 스토리지 저장 오류:', e);
        // 저장 실패 시 가장 오래된 항목 제거 후 재시도
        this.pruneLocalStorageCache();
        
        try {
          const storageKey = this.localStoragePrefix + key;
          localStorage.setItem(storageKey, JSON.stringify({
            value,
            expiry
          }));
        } catch (retryError) {
          // 재시도 실패 시 무시
          logger.error('[SearchCache] 로컬 스토리지 저장 재시도 실패:', retryError);
        }
      }
    }
  }
  
  /**
   * 특정 키의 캐시 삭제
   * @param {string} key - 삭제할 캐시 키
   */
  delete(key) {
    // 메모리 캐시에서 삭제
    this.memoryCache.delete(key);
    
    // 로컬 스토리지에서 삭제
    if (this.useLocalStorage) {
      try {
        const storageKey = this.localStoragePrefix + key;
        localStorage.removeItem(storageKey);
      } catch (e) {
        logger.warn('[SearchCache] 로컬 스토리지 삭제 오류:', e);
      }
    }
  }
  
  /**
   * 모든 캐시 항목 제거
   */
  clear() {
    // 메모리 캐시 초기화
    this.memoryCache.clear();
    
    // 로컬 스토리지 캐시 초기화
    if (this.useLocalStorage) {
      try {
        Object.keys(localStorage)
          .filter(key => key.startsWith(this.localStoragePrefix))
          .forEach(key => localStorage.removeItem(key));
      } catch (e) {
        logger.warn('[SearchCache] 로컬 스토리지 초기화 오류:', e);
      }
    }
  }
  
  /**
   * 만료된 캐시 항목 제거
   */
  cleanup() {
    const now = Date.now();
    
    // 메모리 캐시 정리
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiry < now) {
        this.memoryCache.delete(key);
      }
    }
    
    // 로컬 스토리지 캐시 정리
    if (this.useLocalStorage) {
      try {
        Object.keys(localStorage)
          .filter(key => key.startsWith(this.localStoragePrefix))
          .forEach(key => {
            try {
              const item = JSON.parse(localStorage.getItem(key));
              if (item.expiry < now) {
                localStorage.removeItem(key);
              }
            } catch (e) {
              // 파싱 오류 시 항목 제거
              localStorage.removeItem(key);
            }
          });
      } catch (e) {
        logger.warn('[SearchCache] 로컬 스토리지 정리 오류:', e);
      }
    }
  }
  
  /**
   * 메모리 캐시 정리 (가장 오래된 항목부터 제거)
   */
  pruneMemoryCache() {
    // 만료 시간 기준 정렬
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].expiry - b[1].expiry);
    
    // 절반 제거
    const removeCount = Math.floor(this.memoryCache.size / 2);
    entries.slice(0, removeCount).forEach(([key]) => {
      this.memoryCache.delete(key);
    });
  }
  
  /**
   * 로컬 스토리지 캐시 정리 (가장 오래된 항목부터 제거)
   */
  pruneLocalStorageCache() {
    try {
      // 캐시 항목 추출 및 정렬
      const cacheItems = Object.keys(localStorage)
        .filter(key => key.startsWith(this.localStoragePrefix))
        .map(key => {
          try {
            return {
              key,
              value: JSON.parse(localStorage.getItem(key))
            };
          } catch (e) {
            return { key, value: { expiry: 0 } };
          }
        })
        .sort((a, b) => a.value.expiry - b.value.expiry);
      
      // 절반 제거
      const removeCount = Math.floor(cacheItems.length / 2);
      cacheItems.slice(0, removeCount).forEach(item => {
        localStorage.removeItem(item.key);
      });
    } catch (e) {
      logger.error('[SearchCache] 로컬 스토리지 정리 오류:', e);
    }
  }
  
  /**
   * 검색 쿼리에 대한 캐시 키 생성
   * @param {string} type - 검색 유형 (keyword, ai 등)
   * @param {string} query - 검색 쿼리
   * @param {Object} options - 추가 옵션
   * @returns {string} - 캐시 키
   */
  static generateKey(type, query, options = {}) {
    // 기본 키 생성
    let key = `${type}_${query.toLowerCase().trim()}`;
    
    // 옵션에 따른 키 변형
    if (options) {
      const optionsStr = Object.entries(options)
        .filter(([_, value]) => value !== undefined)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
        .join('_');
      
      if (optionsStr) {
        key += `_${optionsStr}`;
      }
    }
    
    return key;
  }
  
  /**
   * 모든 캐시 키 반환
   * @returns {Array<string>} - 모든 캐시 키 배열
   */
  getAllKeys() {
    const keys = new Set();
    
    // 메모리 캐시 키 추가
    for (const key of this.memoryCache.keys()) {
      keys.add(key);
    }
    
    // 로컬 스토리지 캐시 키 추가
    if (this.useLocalStorage) {
      try {
        Object.keys(localStorage)
          .filter(key => key.startsWith(this.localStoragePrefix))
          .forEach(key => {
            const cacheKey = key.replace(this.localStoragePrefix, '');
            keys.add(cacheKey);
          });
      } catch (e) {
        logger.warn('[SearchCache] 로컬 스토리지 키 조회 오류:', e);
      }
    }
    
    return Array.from(keys);
  }
}

export default SearchCache; 