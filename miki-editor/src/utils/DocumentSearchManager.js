// DocumentSearchManager.js
// AI 패널과 링크 생성 사이에 공유되는 문서 검색 기능을 제공하는 클래스

import { createLogger } from '../utils/logger';
import { useDocumentStore } from '../stores/documentStore.js';
import DocumentSummaryManager from './DocumentSummaryManager.js';

const logger = createLogger('DocumentSearchManager');

// 환경 변수 처리 - Jest 호환성을 위해 기본값 사용
const API_TYPE = 'claude';
const API_KEY = '';
const SERVER_URL = 'http://localhost:3001';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

/**
 * 문서 검색 기능을 제공하는 클래스
 * 키워드 검색과 의미 기반 검색을 결합하여 하이브리드 검색 제공
 */
class DocumentSearchManager {
  constructor() {
    this.summaryManager = new DocumentSummaryManager();
    this.documentCache = new Map(); // 문서 ID를 키로, 문서 내용 및 메타데이터를 값으로 저장
    this.documentEmbeddings = new Map(); // 문서 ID를 키로, 문서 임베딩을 값으로 저장
    this.maxResults = 10; // 검색 결과 최대 개수
    this.useAiSearch = true; // AI 검색 사용 여부
    this.strictSSOT = (typeof window !== 'undefined') ? (window.MIKI_STRICT_SSOT !== false) : true; // 기본 true
    // 변경 이벤트 브리지: 문서 변경 시 내부 캐시 무효화
    this._onDocumentsChanged = (evt) => {
      try {
        const { eventType, affectedIds } = (evt && evt.detail) || {};
        logger.info(`🔔 [DOC-CHANGE] 이벤트 수신: ${eventType} (${(affectedIds || []).length}건)`);
        this.documentCache.clear();
        this.documentEmbeddings.clear();
      } catch (e) {
        logger.warn('변경 이벤트 처리 실패:', e);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('miki:documents:changed', this._onDocumentsChanged);
    }

    // 초기화 시 로컬 스토리지 진단 실행 (개발 모드 1회만)
    try {
      const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
      if (isDev && typeof window !== 'undefined' && !window.__miki_ls_analyzed__) {
        this.analyzeLocalStorage();
        window.__miki_ls_analyzed__ = true;
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 로컬 스토리지 전체 분석 - 디버깅용
   */
  analyzeLocalStorage() {
    try {
      logger.info("===== 로컬 스토리지 분석 시작 =====");
      const allKeys = Object.keys(localStorage);

      logger.info(`총 ${allKeys.length}개 항목이 로컬 스토리지에 저장되어 있습니다.`);

      // 키 패턴별 분류
      const patterns = {
        document: allKeys.filter(key => key.includes('document')),
        title: allKeys.filter(key => key.includes('title')),
        content: allKeys.filter(key => key.includes('content')),
        ai: allKeys.filter(key => key.includes('ai')),
        temp: allKeys.filter(key => key.includes('temp')),
        other: allKeys.filter(key =>
          !key.includes('document') &&
          !key.includes('title') &&
          !key.includes('content') &&
          !key.includes('ai') &&
          !key.includes('temp')
        )
      };

      // 패턴별 출력
      Object.entries(patterns).forEach(([pattern, keys]) => {
        logger.info(`\n[${pattern}] 패턴: ${keys.length}개`);
        keys.slice(0, 5).forEach(key => {
          const value = localStorage.getItem(key);
          const valuePreview = value ?
            (value.length > 50 ? value.substring(0, 50) + '...' : value) :
            '(없음)';
          logger.info(`- ${key}: ${valuePreview}`);
        });
        if (keys.length > 5) {
          logger.info(`... 외 ${keys.length - 5}개`);
        }
      });

      // miki_document 패턴 상세 분석
      const documentKeys = allKeys.filter(key => key.startsWith('miki_document_'));
      logger.info(`\n문서 내용 키(miki_document_*): ${documentKeys.length}개`);
      documentKeys.forEach(key => {
        const docId = key.replace('miki_document_', '');
        const content = localStorage.getItem(key);
        const contentLength = content ? content.length : 0;
        logger.info(`- ${docId}: ${contentLength}자`);

        // 관련 타이틀 확인
        const titleKey = `miki_title_${docId}`;
        const title = localStorage.getItem(titleKey);
        logger.info(`  제목: ${title || '(없음)'}`);
      });

      logger.info("===== 로컬 스토리지 분석 완료 =====");
    } catch (error) {
      logger.error("로컬 스토리지 분석 오류:", error);
    }
  }

  /**
   * 모든 가능한 문서 키 패턴 스캔 및 수집
   * @returns {Object} - 키 패턴별 문서 정보
   */
  scanDocumentPatterns() {
    try {
      logger.info("문서 저장 패턴 스캔 중...");
      const allStorageKeys = Object.keys(localStorage);

      // 🔥 NEW(v2): 키 개수만으로는 부족 → 키 목록 기반 지문으로 캐시 키 생성
      const stableKeys = allStorageKeys
        .filter(k => k.startsWith('miki_document_') || k.startsWith('miki_title_'))
        .sort();
      const fingerprint = `${stableKeys.join('|')}#${stableKeys.length}`;
      const cacheKey = `miki_scan_cache_v2_${fingerprint}`;
      const cachedScan = localStorage.getItem(cacheKey);
      if (cachedScan) {
        try {
          const parsed = JSON.parse(cachedScan);
          const cacheAge = Date.now() - parsed.timestamp;
          // 5분 이내 캐시는 재사용
          if (cacheAge < 5 * 60 * 1000) {
            logger.info("캐시된 스캔 결과 재사용 (성능 최적화)");
            return parsed.documents;
          }
        } catch (e) {
          logger.warn("캐시 파싱 실패, 새로 스캔:", e);
        }
      }

      // 키 패턴 정의
      const patterns = {
        // 현재 편집 중인 임시 문서
        temp: {
          title: 'miki_editor_title_temp',
          content: 'miki_editor_content_temp',
          savedAt: 'miki_editor_saved_at'
        },
        // 저장된 문서 패턴들
        document: {
          prefix: 'miki_document_',
          titlePrefix: 'miki_title_'
        },
        // 기타 패턴
        recentDocs: 'miki_recent_docs',
        conversations: 'miki_ai_conversations_'
      };

      // 패턴별 문서 수집
      const collectedDocs = {};

      // 1. 현재 편집 중인 임시 문서
      const tempTitle = localStorage.getItem(patterns.temp.title);
      const tempContent = localStorage.getItem(patterns.temp.content);
      const tempSavedAt = localStorage.getItem(patterns.temp.savedAt);

      if (tempTitle && tempContent) {
        const tempDoc = {
          id: this.slugify(tempTitle),
          title: tempTitle,
          content: tempContent,
          savedAt: tempSavedAt,
          path: `/doc/${this.slugify(tempTitle)}`,
          isTemp: true
        };
        collectedDocs[tempDoc.id] = tempDoc;
        logger.info(`임시 문서 발견: "${tempTitle}" (${tempContent.length}자)`);
      }

      // 2. 저장된 문서 (miki_document_* 패턴)
      const documentKeys = allStorageKeys.filter(key => key.startsWith(patterns.document.prefix));
      for (const key of documentKeys) {
        try {
          const docId = key.replace(patterns.document.prefix, '');
          const titleKey = `${patterns.document.titlePrefix}${docId}`;
          const rawDocContent = localStorage.getItem(key);

          // JSON 형식으로 저장된 문서 파싱 시도
          let docContent, docTitle;

          try {
            // JSON 파싱 시도
            const docJson = JSON.parse(rawDocContent);
            docTitle = docJson.title || localStorage.getItem(titleKey) || docId;
            docContent = docJson.content || '';

            logger.info(`JSON 파싱 성공: 문서 "${docTitle}" 내용 길이: ${docContent.length}자`);
          } catch (e) {
            // JSON 파싱 실패 시 원본 텍스트 사용
            logger.info(`JSON 파싱 실패, 원본 텍스트 사용: ${e.message}`);
            docTitle = localStorage.getItem(titleKey) || docId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            docContent = rawDocContent;
          }

          if (docId && docContent) {
            const docObject = {
              id: docId,
              title: docTitle,
              content: docContent,
              path: `/doc/${docId}`,
              isDocument: true
            };
            collectedDocs[docId] = docObject;
            logger.info(`저장된 문서 발견: "${docTitle}" (${docContent.length}자)`);
          }
        } catch (docError) {
          logger.error(`문서 키 ${key} 처리 중 오류:`, docError);
        }
      }

      // 3. 최근 문서 목록
      try {
        const recentDocsJson = localStorage.getItem(patterns.recentDocs);
        if (recentDocsJson) {
          const recentDocs = JSON.parse(recentDocsJson);
          if (Array.isArray(recentDocs)) {
            logger.info(`최근 문서 목록: ${recentDocs.length}개`);

            for (const doc of recentDocs) {
              if (!doc.id && !doc.title) continue;

              const docId = doc.id || this.slugify(doc.title);

              // 이미 수집된 문서인지 확인
              if (collectedDocs[docId]) {
                // 이미 있는 문서라면 최근 문서 플래그 추가
                collectedDocs[docId].isRecent = true;
                continue;
              }

              // 문서 내용 검색을 위한 여러 키 패턴 시도
              const contentPatterns = [
                `${patterns.document.prefix}${docId}`,
                `miki_content_${docId}`,
                `miki_doc_content_${docId}`
              ];

              let docContent = null;
              for (const pattern of contentPatterns) {
                docContent = localStorage.getItem(pattern);
                if (docContent) {
                  logger.info(`"${doc.title}" 문서의 내용을 ${pattern} 키에서 찾았습니다.`);
                  break;
                }
              }

              // 최근 문서 추가
              collectedDocs[docId] = {
                id: docId,
                title: doc.title,
                content: docContent || '',
                path: `/doc/${docId}`,
                isRecent: true
              };
            }
          }
        }
      } catch (e) {
        logger.warn("최근 문서 목록 처리 오류:", e);
      }

      // 🔥 NEW: 스캔 결과 캐싱 (성능 최적화 - v2 키)
      const scanResult = Object.values(collectedDocs);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          documents: scanResult
        }));
        logger.info("스캔 결과 캐싱 완료");
      } catch (cacheError) {
        logger.warn("스캔 결과 캐싱 실패:", cacheError);
      }

      // 문서 수 출력 (기존 로직 유지)
      logger.info(`총 ${scanResult.length}개 문서 발견`);

      return scanResult;
    } catch (error) {
      logger.error("문서 패턴 스캔 오류:", error);
      return [];
    }
  }

  /**
   * 모든 문서 가져오기 - 통합 스토어 우선 사용
   * @returns {Promise<Array>} - 문서 배열
   */
  async getAllDocuments() {
    try {
      // 1단계: 통합 스토어에서 먼저 확인
      const documentStore = useDocumentStore.getState();
      const storeDocumentsRaw = documentStore.getAllDocuments();

      if (storeDocumentsRaw.length > 0 && !documentStore.loading) {
        // 스토어 문서 정규화: path/content 보정
        const storeDocuments = storeDocumentsRaw.map(doc => ({
          id: doc.id,
          title: doc.title || '제목 없음',
          content: typeof doc.content === 'string' ? doc.content : '',
          path: doc.path || `/doc/${doc.id}`,
          updatedAt: doc.updatedAt || doc.createdAt,
          isCurrent: documentStore.currentDocumentId === doc.id
        }));
        logger.info(`📚 [DocumentSearchManager] 스토어에서 ${storeDocuments.length}개 문서 반환`);
        return storeDocuments;
      }

      // 2단계: 스토어가 비어있으면 서버에서 최신 데이터 가져오기
      logger.info("📡 [DocumentSearchManager] 서버에서 최신 문서 목록 가져오는 중...");
      documentStore.setLoading(true);

      const response = await fetch('/api/posts');
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }

      const serverDocuments = await response.json();
      logger.info(`🌐 [DocumentSearchManager] 서버에서 ${serverDocuments.length}개 문서 수신`);

      // 3단계: 서버 데이터를 스토어에 동기화
      documentStore.setDocuments(serverDocuments);

      return serverDocuments;

    } catch (error) {
      logger.error("📚 [DocumentSearchManager] 문서 목록 가져오기 실패:", error);

      // 4단계: 폴백 - 기존 로직 사용
      return await this.getAllDocumentsLegacy();
    }
  }

  /**
   * 기존 getAllDocuments 로직 (폴백용)
   * @returns {Promise<Array>} - 문서 배열
   */
  async getAllDocumentsLegacy() {
    try {
      logger.info("모든 문서 정보 로드 중...");

      // 🔥 NEW: IndexedDB에서 실제 문서 가져오기 (기존 로직 개선)
      let allDocuments = [];

      try {
        // IndexedDB에서 문서 가져오기 시도
        const { db } = await import('../utils/database.js');
        const indexedDocs = await db.documents.toArray();

        if (indexedDocs && indexedDocs.length > 0) {
          logger.info(`✅ IndexedDB에서 ${indexedDocs.length}개 문서 발견`);

          // IndexedDB 문서를 검색 형식으로 변환
          allDocuments = indexedDocs.map(doc => ({
            id: doc.id,
            title: doc.title || '제목 없음',
            content: doc.content || '',
            path: `/doc/${doc.id}`,
            updatedAt: doc.updatedAt,
            isFromIndexedDB: true
          }));

          logger.info(`✅ IndexedDB 문서 변환 완료: ${allDocuments.length}개`);
        } else {
          logger.warn("⚠️ IndexedDB에서 문서를 찾을 수 없음, localStorage 스캔으로 대체");
        }
      } catch (indexedDbError) {
        logger.error("❌ IndexedDB 접근 실패, localStorage 스캔으로 대체:", indexedDbError);
      }

      // 🔥 FALLBACK: IndexedDB 실패 시 기존 localStorage 스캔 사용 (안전장치)
      // 단, SSOT 엄격 모드에서는 localStorage 스캔을 비활성화
      if (allDocuments.length === 0 && !this.strictSSOT) {
        logger.info("📁 localStorage 스캔 시작 (백업 방식)");

        // 개선된 문서 패턴 스캔 사용 (기존 로직 유지)
        const scannedDocs = this.scanDocumentPatterns();

        if (scannedDocs && scannedDocs.length > 0) {
          allDocuments = scannedDocs;
          logger.info(`✅ localStorage에서 ${allDocuments.length}개 문서 발견`);
        } else {
          logger.warn("⚠️ localStorage에서도 문서를 찾을 수 없음");
        }
      }

      // 🔥 LAST RESORT: 모든 방법 실패 시 샘플 문서 제공 (사용자 경험 보장)
      if (allDocuments.length === 0) {
        logger.info("📝 샘플 문서 제공 (사용자 경험 보장)");
        allDocuments = [
          {
            id: 'sample-welcome',
            title: '환영합니다!',
            content: '미키 에디터에 오신 것을 환영합니다. 새로운 문서를 만들어보세요.',
            path: '/doc/sample-welcome',
            isSample: true
          },
          {
            id: 'sample-help',
            title: '도움말',
            content: '# 미키 에디터 사용법\n\n1. 텍스트를 입력하세요\n2. AI 명령을 사용하세요\n3. 링크를 생성하세요',
            path: '/doc/sample-help',
            isSample: true
          }
        ];
      }

      // 🔥 NEW: 문서 품질 검증 (데이터 무결성 보장)
      const validDocuments = allDocuments.filter(doc => {
        const isValid = doc && doc.id && doc.title && doc.path;
        if (!isValid) {
          logger.warn(`⚠️ 유효하지 않은 문서 발견:`, doc);
        }
        return isValid;
      });

      logger.info(`✅ 검색 가능한 모든 문서: ${validDocuments.length} 건`);

      // 🔥 NEW: 문서 통계 로깅 (모니터링 강화)
      const stats = {
        total: validDocuments.length,
        fromIndexedDB: validDocuments.filter(doc => doc.isFromIndexedDB).length,
        fromLocalStorage: validDocuments.filter(doc => !doc.isFromIndexedDB && !doc.isSample).length,
        samples: validDocuments.filter(doc => doc.isSample).length
      };

      logger.info(`📊 문서 통계:`, stats);

      return validDocuments;
    } catch (error) {
      logger.error("❌ getAllDocuments 실행 중 오류:", error);

      // 🔥 ERROR RECOVERY: 오류 발생 시 빈 배열 반환 (시스템 안정성 보장)
      return [];
    }
  }

  /**
   * 키워드 기반 로컬 문서 검색
   * @param {string} query - 검색어
   * @returns {Promise<Array>} - 검색 결과 배열
   */
  async searchByKeyword(query) {
    if (!query || query.trim().length === 0) return [];

    logger.info("키워드 검색 시작:", query);
    const searchQuery = query.toLowerCase().trim();

    try {
      // URL 형식이면 검색하지 않고 바로 반환
      if (/^https?:\/\//i.test(searchQuery)) {
        logger.info("URL 형식 감지:", searchQuery);
        return [{ id: 'url', title: `URL: ${searchQuery}`, path: searchQuery, isUrl: true }];
      }

      // 문서 로드
      const allDocuments = await this.getAllDocuments();
      logger.info(`검색 대상 문서: ${allDocuments.length}개`);

      // 검색어로 필터링 (개선된 로그 추가)
      const searchResults = allDocuments.filter(doc => {
        const docTitle = (doc.title || '').toLowerCase();

        // 내용 확인 - content 속성이 있는지 확인
        let docContent = '';
        if (doc.content) {
          if (typeof doc.content === 'string') {
            docContent = doc.content.toLowerCase();
          } else if (typeof doc.content === 'object') {
            // content가 객체인 경우 (내용 디버깅)
            logger.info(`문서 "${doc.title}"의 content가 객체입니다:`, doc.content);
            docContent = JSON.stringify(doc.content).toLowerCase();
          }
        }

        const titleMatch = docTitle.includes(searchQuery);
        const contentMatch = docContent && docContent.includes(searchQuery);

        logger.info(`문서 "${doc.title}" 검색 결과: 제목 일치=${titleMatch}, 내용 일치=${contentMatch}`);
        logger.info(`- 제목: ${docTitle}`);
        logger.info(`- 내용 타입: ${typeof doc.content}`);
        logger.info(`- 내용 일부: ${docContent ? docContent.substring(0, 50) + '...' : '(내용 없음)'}`);

        return titleMatch || contentMatch;
      });

      logger.info(`키워드 "${searchQuery}" 검색 결과: ${searchResults.length}개 문서 일치`);

      if (searchResults.length > 0) {
        logger.info("키워드 검색 결과:", searchResults.length, "건");

        // 현재 문서 > 제목 일치 > 내용 일치 순으로 정렬
        return searchResults.sort((a, b) => {
          if (a.isCurrent && !b.isCurrent) return -1;
          if (!a.isCurrent && b.isCurrent) return 1;

          const aTitleMatch = a.title.toLowerCase().includes(searchQuery);
          const bTitleMatch = b.title.toLowerCase().includes(searchQuery);

          if (aTitleMatch && !bTitleMatch) return -1;
          if (!aTitleMatch && bTitleMatch) return 1;

          return a.title.localeCompare(b.title);
        }).slice(0, this.maxResults).map(doc => ({
          id: doc.id,
          title: doc.title + (doc.isCurrent ? ' (현재 문서)' : doc.isRecent ? ' (최근 문서)' : ''),
          path: doc.path,
          preview: doc.content ? doc.content.substring(0, 100) + '...' : null
        }));
      }

      // 검색 결과가 없으면 새 문서 만들기 옵션 제공
      logger.info("검색 결과 없음, 새 문서 만들기 옵션 제공");
      return [
        {
          id: 'new_' + searchQuery,
          title: `"${searchQuery}" 새 문서 생성`,
          path: `/doc/${this.slugify(searchQuery)}`,
          preview: `"${searchQuery}" 문서를 새로 생성합니다.`,
          isCreateNew: true
        }
      ];
    } catch (error) {
      logger.error("키워드 검색 오류:", error);
      return [
        {
          id: 'error',
          title: '오류 발생 - URL 직접 입력',
          path: '#',
          preview: 'URL을 직접 입력하여 외부 링크를 생성할 수 있습니다.',
          isError: true
        }
      ];
    }
  }

  /**
   * 의미 기반 문서 검색 - 토큰 최적화된 검색 구현
   * @param {string} query - 검색어
   * @returns {Promise<Array>} - 의미 기반 검색 결과 배열
   */
  async searchBySemantic(query) {
    if (!query || query.trim().length === 0) return [];

    logger.info("의미 기반 검색 시작:", query);

    try {
      // 1단계: 로컬 문서 가져오기
      const allDocuments = await this.getAllDocuments();
      logger.info(`의미 기반 검색 대상 문서: ${allDocuments.length}개`);

      if (allDocuments.length === 0) {
        logger.info("검색 대상 문서가 없습니다");
        return [];
      }

      // 2단계: 토큰 최적화를 위한 로컬 필터링
      // 쿼리를 의미 있는 키워드로 분리
      const queryText = query.toLowerCase().trim();
      // 단어 최소 길이를 0으로 낮춤 (모든 단어 허용)
      const queryWords = queryText.split(/\s+/).filter(word => word.length > 0);

      logger.info("검색 키워드:", queryWords);

      // 각 문서별 관련도 점수 계산 (간단한 TF-IDF 유사)
      const scoredDocuments = allDocuments.map(doc => {
        try {
          // 문서 텍스트 준비
          const docTitle = (doc.title || '').toLowerCase();

          // 내용 확인 - content 속성이 있는지 확인
          let docContent = '';
          if (doc.content) {
            if (typeof doc.content === 'string') {
              docContent = doc.content.toLowerCase();
            } else if (typeof doc.content === 'object') {
              // content가 객체인 경우 (내용 디버깅)
              logger.info(`문서 "${doc.title}"의 content가 객체입니다:`, doc.content);
              docContent = JSON.stringify(doc.content).toLowerCase();
            }
          }

          // 디버깅용 로그
          logger.info(`문서 "${doc.title}" 내용 검색 시작 (내용 길이: ${docContent ? docContent.length : 0}자)`);
          logger.info(`- 내용 타입: ${typeof doc.content}`);

          // 기본 점수 계산
          let score = 0;

          // 제목에 쿼리 전체가 포함되어 있으면 높은 점수
          if (docTitle.includes(queryText)) {
            score += 15;  // 점수 상향 조정
            logger.info(`- 제목 전체 일치 (${queryText}): +15점`);
          }

          // 내용에 쿼리 전체가 포함되어 있으면 점수 추가
          if (docContent && docContent.includes(queryText)) {
            score += 8;  // 점수 상향 조정
            logger.info(`- 내용 전체 일치 (${queryText}): +8점`);
          }

          // 각 쿼리 단어별 점수 계산
          for (const word of queryWords) {
            // 제목에 단어가 포함되어 있으면 점수 추가
            if (docTitle.includes(word)) {
              score += 3;
              logger.info(`- 제목 단어 일치 (${word}): +3점`);
            }

            // 내용에 단어가 포함되어 있으면 점수 추가 (가중치 증가)
            if (docContent && docContent.includes(word)) {
              score += 2;
              logger.info(`- 내용 단어 일치 (${word}): +2점`);
            }

            // 단어 발생 빈도에 따라 추가 점수
            try {
              const titleMatches = (docTitle.match(new RegExp(word, 'gi')) || []).length;
              const contentMatches = docContent ? (docContent.match(new RegExp(word, 'gi')) || []).length : 0;

              score += titleMatches * 0.5;
              score += contentMatches * 0.3;

              if (titleMatches > 0 || contentMatches > 0) {
                logger.info(`- 단어 빈도 (${word}): 제목=${titleMatches}회, 내용=${contentMatches}회, +${titleMatches * 0.5 + contentMatches * 0.3}점`);
              }
            } catch (regexError) {
              logger.warn(`정규식 오류 (${word}):`, regexError);
            }
          }

          // 문서 추가 가중치
          let finalScore = score;

          if (doc.content && doc.content.length > 0) {
            finalScore *= 1.2;  // 내용이 있는 문서 우대
            logger.info(`- 내용 존재 가중치: x1.2 (${score} -> ${finalScore})`);
          }

          if (doc.isTemp) {
            finalScore *= 1.5;  // 현재 편집 중인 문서 우대
            logger.info(`- 현재 문서 가중치: x1.5 (${score} -> ${finalScore})`);
          } else if (doc.isRecent) {
            finalScore *= 1.3;  // 최근 문서 우대
            logger.info(`- 최근 문서 가중치: x1.3 (${score} -> ${finalScore})`);
          }

          logger.info(`문서 "${doc.title}" 최종 점수: ${finalScore}`);

          return { ...doc, score: finalScore };
        } catch (docError) {
          logger.error(`문서 "${doc.title}" 점수 계산 오류:`, docError);
          return { ...doc, score: 0 };
        }
      });

      // 디버깅용: 각 문서의 점수 확인 (상위 5개만)
      const top5Docs = [...scoredDocuments]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      top5Docs.forEach(doc => {
        logger.info(`문서 "${doc.title}" 점수: ${doc.score}`);
      });

      // 점수 기준 정렬 및 필터링
      const sortedDocuments = scoredDocuments
        .filter(doc => doc.score > 0.5)  // 낮은 점수 문서 제외 (임계값 낮춤)
        .sort((a, b) => b.score - a.score);  // 점수 높은 순으로 정렬

      // 3단계: 최종 결과 구성
      // 상위 결과만 반환 (토큰 최적화)
      const topResults = sortedDocuments.slice(0, this.maxResults);

      if (topResults.length > 0) {
        logger.info(`의미 기반 검색 결과: ${topResults.length}건`);
        return topResults.map(doc => ({
          id: doc.id,
          title: doc.title + (doc.isTemp ? ' (현재 문서)' : doc.isRecent ? ' (최근 문서)' : ''),
          path: doc.path || `/doc/${doc.id}`,
          preview: this.generatePreview(doc.content, queryText),
          score: doc.score,
          isSemanticMatch: true
        }));
      }

      // 4단계: 결과가 없는 경우 새 문서 생성 옵션 제공
      logger.info("의미 기반 검색 결과 없음, 새 문서 옵션 제공");
      return [{
        id: 'new_' + queryText,
        title: `"${queryText}" 새 문서 생성`,
        path: `/doc/${this.slugify(queryText)}`,
        preview: `"${queryText}"에 관한 새 문서를 생성합니다.`,
        isCreateNew: true,
        isSemanticMatch: true
      }];
    } catch (error) {
      logger.error("의미 기반 검색 오류:", error);
      return [];
    }
  }

  /**
   * 검색어 주변 문맥을 추출하여 미리보기 생성
   * @param {string|object} content - 문서 내용 (문자열 또는 객체)
   * @param {string} query - 검색어
   * @returns {string} - 미리보기 텍스트
   */
  generatePreview(content, query) {
    if (!content || !query) return '';

    // content가 객체인 경우 문자열로 변환
    let contentStr = '';
    if (typeof content === 'string') {
      contentStr = content;
    } else if (typeof content === 'object') {
      // content가 객체이고 content.content가 있으면 해당 값 사용
      if (content.content && typeof content.content === 'string') {
        contentStr = content.content;
      } else {
        // 그 외의 경우 JSON 문자열로 변환
        contentStr = JSON.stringify(content);
      }
    }

    // 마크다운 태그 제거
    const cleanContent = contentStr.replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*#_~`>]/g, '');

    // 검색어 위치 찾기
    const queryPosition = cleanContent.toLowerCase().indexOf(query.toLowerCase());

    if (queryPosition === -1) {
      // 검색어가 정확히 없으면 문서 앞부분 반환
      return cleanContent.slice(0, 100) + '...';
    }

    // 검색어 주변 문맥 추출 (앞뒤 50자)
    const start = Math.max(0, queryPosition - 50);
    const end = Math.min(cleanContent.length, queryPosition + query.length + 50);

    let preview = cleanContent.slice(start, end);

    // 시작/끝 부분 처리
    if (start > 0) preview = '...' + preview;
    if (end < cleanContent.length) preview = preview + '...';

    return preview;
  }

  /**
   * AI를 활용한 문서 검색 (Claude API 사용)
   * @param {string} query - 검색어
   * @returns {Promise<Array>} - 검색 결과 배열
   */
  async searchByAi(query) {
    if (!query || query.trim().length === 0) return [];

    logger.info("AI 기반 검색 시작:", query);
    const searchQuery = query.toLowerCase().trim();

    try {
      // 문서 로드
      const allDocuments = await this.getAllDocuments();
      logger.info(`AI 검색 대상 문서: ${allDocuments.length}개`);

      if (allDocuments.length === 0) {
        return [];
      }

      // 모든 문서 내용 통합 (AI에 전송할 컨텍스트)
      let documentsContext = "검색 가능한 문서 목록:\n\n";
      allDocuments.forEach((doc, index) => {
        let docContent = '';
        if (typeof doc.content === 'string') {
          docContent = doc.content.substring(0, 200); // 내용은 일부만 포함
        } else if (typeof doc.content === 'object') {
          docContent = doc.content.content || JSON.stringify(doc.content).substring(0, 200);
        }

        documentsContext += `${index + 1}. 제목: ${doc.title}, id: ${doc.id}\n`;
        documentsContext += `   내용 일부: ${docContent}...\n\n`;
      });

      // Claude API 요청 구성
      const prompt = `
당신은 문서 검색 도우미입니다. 아래 문서 목록에서 다음 검색어와 가장 관련성이 높은 문서를 찾아 문서 제목, id, 관련성 점수, 간단한 이유를 JSON 형식으로 반환해주세요.

검색어: "${searchQuery}"

${documentsContext}

검색 결과는 다음 JSON 형식으로 반환해주세요:
\`\`\`json
{
  "results": [
    {
      "id": "문서 id",
      "title": "문서 제목",
      "score": 0.95,
      "reason": "이 문서가 검색어와 관련이 있는 이유에 대한 간단한 설명"
    },
    ...
  ]
}
\`\`\`

**중요: 동일한 id의 문서는 한 번만 결과에 포함해주세요.**
최대 ${this.maxResults}개의 관련 문서만 포함해 주세요. 관련성이 높은 순서로 정렬해 주세요.
`;

      // 백엔드 프록시 서버를 통해 API 호출
      const response = await fetch('http://localhost:3003/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI 검색 API 오류: ${response.status}`);
      }

      const responseData = await response.json();
      logger.info("AI 검색 응답:", responseData);

      // 응답에서 JSON 파싱
      const textContent = responseData.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error("AI 응답에서 JSON 형식을 찾을 수 없습니다");
      }

      const aiResults = JSON.parse(jsonMatch[1]);
      logger.info("파싱된 AI 검색 결과:", aiResults);

      // AI 결과를 실제 문서와 매핑
      const mappedResults = [];
      const seenIds = new Set(); // 중복 방지를 위한 Set
      const seenTitles = new Set(); // 제목 기반 중복 방지

      logger.info(`AI 검색 결과 매핑 시작: ${aiResults.results.length}개 결과`);

      aiResults.results.forEach((result, index) => {
        // 1차: id 기반 중복 체크
        if (seenIds.has(result.id)) {
          logger.warn(`[중복 제거] ID 중복으로 건너뜀: ${result.id} (${result.title})`);
          return;
        }

        // 2차: 제목 기반 중복 체크 (같은 제목의 다른 id 방지)
        const normalizedTitle = result.title.toLowerCase().trim();
        if (seenTitles.has(normalizedTitle)) {
          logger.warn(`[중복 제거] 제목 중복으로 건너뜀: "${result.title}" (ID: ${result.id})`);
          return;
        }

        // 1순위: id로 정확 매칭
        let matchedDoc = allDocuments.find(doc => doc.id === result.id);

        // 2순위: 제목으로 매칭 (id 매칭이 실패한 경우)
        if (!matchedDoc) {
          matchedDoc = allDocuments.find(doc =>
            doc.title.toLowerCase() === result.title.toLowerCase() ||
            doc.title.toLowerCase().includes(result.title.toLowerCase()) ||
            result.title.toLowerCase().includes(doc.title.toLowerCase())
          );
        }

        if (matchedDoc) {
          // 실제 문서 매칭 성공
          const docId = matchedDoc.id;
          const docTitle = matchedDoc.title.toLowerCase().trim();

          // 실제 문서 기준으로 중복 체크 (AI 결과와 실제 문서가 다를 수 있음)
          if (seenIds.has(docId)) {
            logger.warn(`[중복 제거] 실제 문서 ID 중복으로 건너뜀: ${docId}`);
            return;
          }

          if (seenTitles.has(docTitle)) {
            logger.warn(`[중복 제거] 실제 문서 제목 중복으로 건너뜀: "${matchedDoc.title}"`);
            return;
          }

          // 중복 체크 통과, 결과 추가
          seenIds.add(docId);
          seenTitles.add(docTitle);

          mappedResults.push({
            id: docId,
            title: matchedDoc.title,
            path: matchedDoc.path,
            preview: result.reason || matchedDoc.preview,
            score: result.score,
            isAiMatch: true,
            searchIndex: index + 1
          });

          logger.info(`[매핑 성공] ${docId} → "${matchedDoc.title}" (점수: ${result.score})`);

        } else {
          // 매칭되는 문서가 없는 경우 새 문서 생성 옵션
          const newId = result.id || this.slugify(result.title);

          if (!seenIds.has(newId) && !seenTitles.has(normalizedTitle)) {
            seenIds.add(newId);
            seenTitles.add(normalizedTitle);

            mappedResults.push({
              id: newId,
              title: result.title,
              path: `/doc/${newId}`,
              preview: result.reason,
              score: result.score,
              isAiMatch: true,
              isCreateNew: true,
              searchIndex: index + 1
            });

            logger.info(`[새 문서 옵션] ${newId} → "${result.title}" (점수: ${result.score})`);
          }
        }
      });

      // 최종 중복 검사 (안전장치)
      const finalResults = [];
      const finalCheck = new Set();

      mappedResults.forEach(result => {
        const checkKey = `${result.id}|${result.title.toLowerCase()}`;
        if (!finalCheck.has(checkKey)) {
          finalCheck.add(checkKey);
          finalResults.push(result);
        } else {
          logger.warn(`[최종 중복 제거] ${result.id} → "${result.title}"`);
        }
      });

      logger.info(`AI 검색 최종 결과: ${finalResults.length}개 (중복 제거 완료)`);
      logger.info("최종 결과 목록:", finalResults.map(r => `${r.id}:"${r.title}"`));

      return finalResults;
    } catch (error) {
      logger.error("AI 검색 오류:", error);
      // 오류 발생 시 기본 키워드 검색으로 폴백
      logger.info("AI 검색 실패, 키워드 검색으로 대체");
      return await this.searchByKeyword(query);
    }
  }

  /**
   * 통합 검색 - AI 검색 또는 키워드 검색을 선택적으로 사용
   * @param {string} query - 검색어
   * @returns {Promise<Array>} - 검색 결과 배열
   */
  async searchDocuments(query) {
    logger.info("통합 문서 검색 시작:", query);
    if (!query || query.trim().length === 0) return [];

    try {
      // URL 형식 확인
      if (/^https?:\/\//i.test(query.trim())) {
        logger.info("URL 형식 감지:", query);
        return [{ id: 'url', title: `URL: ${query.trim()}`, path: query.trim(), isUrl: true }];
      }

      if (this.useAiSearch) {
        // AI 검색 사용 시
        logger.info("AI 검색 모드로 실행");
        const aiResults = await this.searchByAi(query);

        if (aiResults.length > 0) {
          logger.info("AI 검색 결과 찾음:", aiResults.length);
          return aiResults;
        }
      }

      // AI 검색 결과가 없거나 AI 검색을 사용하지 않는 경우 기존 로직 실행
      // 1단계: 키워드 검색 먼저 시도
      logger.info("키워드 검색 시작");
      const keywordResults = await this.searchByKeyword(query);

      // 키워드 검색 결과가 있고, 새 문서 생성 옵션만 있는 것이 아니면 결과 반환
      if (keywordResults.length > 0 && !keywordResults.some(result => result.isCreateNew)) {
        logger.info("키워드 검색 결과 찾음:", keywordResults.length);
        return keywordResults;
      }

      // 2단계: 키워드 검색 결과가 없거나 새 문서 생성 옵션만 있으면 의미 기반 검색 실행
      logger.info("의미 기반 검색으로 전환");
      const semanticResults = await this.searchBySemantic(query);

      // 의미 기반 검색에서 새 문서 생성 옵션이 아닌 결과가 있는 경우
      if (semanticResults.length > 0 && semanticResults.some(result => !result.isCreateNew)) {
        logger.info("의미 기반 검색 결과 반환:", semanticResults.length);
        return semanticResults;
      }

      // 3단계: 두 검색 모두 실제 결과가 없고 새 문서 생성 옵션만 있는 경우
      if (keywordResults.length > 0) {
        logger.info("새 문서 생성 옵션만 있음, 키워드 검색 결과 반환");
        return keywordResults;
      }

      logger.info("새 문서 생성 옵션만 있음, 의미 기반 검색 결과 반환");
      return semanticResults;
    } catch (error) {
      logger.error("통합 문서 검색 오류:", error);
      return [{
        id: 'error',
        title: '오류 발생 - 검색 실패',
        path: '#',
        preview: '검색 중 오류가 발생했습니다. 다시 시도하거나 URL을 직접 입력하세요.',
        isError: true
      }];
    }
  }

  /**
   * 문자열을 슬러그 형식으로 변환 (URL 친화적인 형식)
   * @param {string} str - 변환할 문자열
   * @returns {string} - 슬러그 형식의 문자열
   */
  slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-') // 공백, 특수문자를 하이픈으로 변환
      .replace(/^-+|-+$/g, '');  // 시작/끝 하이픈 제거
  }

  /**
   * 사용자 지정 문서만 보존하는 강력한 정리 함수
   * @param {Array} keepTitles - 보존할 문서 제목 배열
   * @param {boolean} dryRun - true면 실제 삭제하지 않고 로그만 출력
   * @returns {Object} - 정리 결과 통계
   */
  cleanupKeepOnlySpecified(keepTitles = ['제니', '로제', '아파트', '먐시리', '블랙핑크'], dryRun = false) {
    logger.info(`=== 지정 문서만 보존 정리 ${dryRun ? '(시뮬레이션)' : '(실제 실행)'} ===`);
    logger.info(`보존할 문서: ${keepTitles.join(', ')}`);

    const stats = {
      totalDocuments: 0,
      preservedDocuments: 0,
      deletedDocuments: 0,
      spaceSaved: 0,
      backupCreated: false,
      errors: []
    };

    try {
      // 1단계: 모든 문서 수집
      const documentKeys = Object.keys(localStorage).filter(key => key.startsWith('miki_document_'));
      stats.totalDocuments = documentKeys.length;

      logger.info(`📊 분석 시작: 총 ${documentKeys.length}개 문서 발견`);

      // 2단계: 백업 생성 (삭제할 문서가 있을 때만)
      if (!dryRun) {
        // 먼저 삭제할 문서가 있는지 미리 확인
        let hasDocumentsToDelete = false;
        for (const key of documentKeys) {
          try {
            const docData = JSON.parse(localStorage.getItem(key));
            if (!docData || !docData.title) {
              hasDocumentsToDelete = true;
              break;
            }
            const title = docData.title.trim().toLowerCase();
            const shouldKeep = keepTitles.some(keepTitle =>
              title === keepTitle.toLowerCase()
            );
            if (!shouldKeep) {
              hasDocumentsToDelete = true;
              break;
            }
          } catch (e) {
            hasDocumentsToDelete = true;
            break;
          }
        }

        // 삭제할 문서가 있을 때만 백업 생성
        if (hasDocumentsToDelete) {
          const backupData = {};
          documentKeys.forEach(key => {
            backupData[key] = localStorage.getItem(key);
          });

          const backupKey = `miki_backup_manual_${Date.now()}`;
          localStorage.setItem(backupKey, JSON.stringify({
            timestamp: new Date().toISOString(),
            documents: backupData,
            type: 'manual_cleanup'
          }));
          stats.backupCreated = true;
          logger.info(`✅ 백업 완료: ${backupKey}`);
        } else {
          logger.info(`⏭️ 백업 건너뜀: 삭제할 문서가 없음`);
        }
      }

      // 3단계: 문서 분류 및 중복 제거
      const preserveList = [];
      const deleteList = [];
      const titleGroups = {}; // 제목별 그룹화

      // 먼저 제목별로 그룹화
      for (const key of documentKeys) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));

          if (!docData || !docData.title) {
            deleteList.push({ key, reason: '제목 없음', size: localStorage.getItem(key)?.length || 0 });
            continue;
          }

          const title = docData.title.trim().toLowerCase();

          if (!titleGroups[title]) {
            titleGroups[title] = [];
          }

          titleGroups[title].push({
            key,
            title: docData.title,
            data: docData,
            updatedAt: new Date(docData.updatedAt || 0)
          });

        } catch (e) {
          deleteList.push({ key, reason: '파싱 오류', size: localStorage.getItem(key)?.length || 0 });
          logger.info(`❌ 삭제 예정: ${key} - 파싱 오류`);
        }
      }

      // 각 제목 그룹에서 처리
      for (const [titleLower, docs] of Object.entries(titleGroups)) {
        const shouldKeep = keepTitles.some(keepTitle =>
          titleLower === keepTitle.toLowerCase()
        );

        if (shouldKeep) {
          // 보존할 제목인 경우: 최신 문서만 보존, 나머지는 삭제
          docs.sort((a, b) => b.updatedAt - a.updatedAt); // 최신순 정렬

          const latestDoc = docs[0]; // 가장 최신 문서
          const duplicates = docs.slice(1); // 나머지 중복 문서들

          preserveList.push(latestDoc);
          logger.info(`✅ 보존: ${latestDoc.key} - "${latestDoc.title}" (최신 버전)`);

          // 중복 문서들은 삭제 목록에 추가
          for (const duplicate of duplicates) {
            deleteList.push({
              key: duplicate.key,
              title: duplicate.title,
              reason: `중복 문서 (${latestDoc.key}가 최신)`,
              size: localStorage.getItem(duplicate.key)?.length || 0
            });
            logger.info(`❌ 삭제 예정: ${duplicate.key} - "${duplicate.title}" (중복)`);
          }
        } else {
          // 보존하지 않을 제목인 경우: 모든 문서 삭제
          for (const doc of docs) {
            deleteList.push({
              key: doc.key,
              title: doc.title,
              reason: '지정 목록에 없음',
              size: localStorage.getItem(doc.key)?.length || 0
            });
            logger.info(`❌ 삭제 예정: ${doc.key} - "${doc.title}" (보존 목록에 없음)`);
          }
        }
      }

      stats.preservedDocuments = preserveList.length;
      stats.deletedDocuments = deleteList.length;

      // 4단계: 실제 삭제 실행
      logger.info(`\n🔥 삭제 실행: ${deleteList.length}개 문서`);

      if (!dryRun && deleteList.length > 0) {
        let successCount = 0;

        for (const item of deleteList) {
          try {
            localStorage.removeItem(item.key);

            // 관련 제목 키도 삭제
            const titleKey = item.key.replace('miki_document_', 'miki_title_');
            if (localStorage.getItem(titleKey)) {
              localStorage.removeItem(titleKey);
            }

            stats.spaceSaved += item.size;
            successCount++;
            logger.info(`  ✅ 삭제 완료: ${item.key}`);
          } catch (error) {
            logger.error(`  ❌ 삭제 실패: ${item.key}`, error);
            stats.errors.push(`삭제 실패: ${item.key} - ${error.message}`);
          }
        }

        logger.info(`✅ 삭제 완료: ${successCount}/${deleteList.length}개`);
      }

      // 5단계: 최근 문서 목록 재구성
      if (!dryRun && deleteList.length > 0) {
        try {
          const remainingDocs = preserveList.map(item => ({
            id: item.data.id || item.key.replace('miki_document_', ''),
            title: item.data.title,
            updatedAt: item.data.updatedAt || new Date().toISOString()
          }));

          remainingDocs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          localStorage.setItem('miki_recent_docs', JSON.stringify(remainingDocs));

          logger.info(`📝 최근 문서 목록 재구성: ${remainingDocs.length}개`);
        } catch (error) {
          logger.error('최근 문서 목록 재구성 오류:', error);
        }
      }

      // 6단계: 결과 보고
      logger.info(`\n📊 === 정리 완료 보고서 ===`);
      logger.info(`총 문서: ${stats.totalDocuments}개`);
      logger.info(`보존된 문서: ${stats.preservedDocuments}개`);
      logger.info(`삭제된 문서: ${stats.deletedDocuments}개`);
      logger.info(`절약된 공간: ${(stats.spaceSaved / 1024).toFixed(1)}KB`);

      if (stats.backupCreated) {
        logger.info(`\n🛡️ 백업 정보:`);
        logger.info(`백업 키: miki_backup_manual_*`);
        logger.info(`복구 방법: 개발자 도구에서 백업 키로 검색하여 복구 가능`);
      }

      if (stats.errors.length > 0) {
        logger.info(`\n⚠️ 오류 ${stats.errors.length}개:`);
        stats.errors.forEach(error => logger.info(`  - ${error}`));
      }

    } catch (error) {
      logger.error('지정 문서 보존 정리 중 오류:', error);
      stats.errors.push(`정리 오류: ${error.message}`);
    }

    return stats;
  }
}

export default DocumentSearchManager;
