import { createLogger } from '../utils/logger';
const logger = createLogger('DataSyncManager');
/**
 * 서버와 로컬 스토리지 간의 데이터 동기화를 관리하는 클래스
 * 수정: 서버 API 구조에 맞게 동기화 로직 개선
 */
class DataSyncManager {
  constructor() {
    this.serverUrl = 'http://localhost:3003/api/posts';
    this.syncInProgress = false;
  }

  /**
   * 서버와 로컬 스토리지 완전 동기화
   * @param {Array} keepTitles - 보존할 문서 제목 배열
   * @returns {Object} - 동기화 결과
   */
  async fullSync(keepTitles = ['제니', '로제', '먐시리', '블랙핑크']) {
    if (this.syncInProgress) {
      logger.info('동기화가 이미 진행 중입니다.');
      return { success: false, message: '동기화 진행 중' };
    }

    this.syncInProgress = true;
    logger.info('=== 전체 데이터 동기화 시작 ===');

    try {
      // 1단계: 서버 문서 목록 가져오기
      const serverDocs = await this.getServerDocuments();
      logger.info(`서버 문서: ${serverDocs.length}개`);

      // 2단계: 로컬 스토리지 문서 목록 가져오기
      const localDocs = this.getLocalDocuments();
      logger.info(`로컬 문서: ${localDocs.length}개`);

      // 3단계: 보존할 문서만 필터링
      const filteredServerDocs = serverDocs.filter(doc =>
        keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
      );
      const filteredLocalDocs = localDocs.filter(doc =>
        keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
      );

      logger.info(`필터링 후 - 서버: ${filteredServerDocs.length}개, 로컬: ${filteredLocalDocs.length}개`);

      // 4단계: 불필요한 서버 문서 삭제
      const serverDeleteResults = await this.cleanupServerDocuments(serverDocs, keepTitles);

      // 5단계: 불필요한 로컬 문서 삭제
      const localDeleteResults = this.cleanupLocalDocuments(localDocs, keepTitles);

      // 6단계: 최신 버전으로 통합
      const mergeResults = await this.mergeDocuments(filteredServerDocs, filteredLocalDocs);

      const result = {
        success: true,
        serverDeleted: serverDeleteResults.deleted,
        localDeleted: localDeleteResults.deleted,
        merged: mergeResults.merged,
        finalCount: mergeResults.finalDocuments.length,
        message: `동기화 완료: ${mergeResults.finalDocuments.length}개 문서 유지`
      };

      logger.info('=== 전체 데이터 동기화 완료 ===');
      logger.info(result);

      return result;

    } catch (error) {
      logger.error('동기화 오류:', error);
      return {
        success: false,
        error: error.message,
        message: '동기화 실패'
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 서버에서 모든 문서 가져오기 (수정: title 추출 로직 개선)
   */
  async getServerDocuments() {
    try {
      const response = await fetch(this.serverUrl);
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }

      const serverPosts = await response.json();

      // 각 문서의 전체 내용을 개별적으로 가져오기
      const fullDocuments = [];
      for (const post of serverPosts) {
        try {
          const fullContent = await this.getServerDocument(post.id);
          fullDocuments.push({
            id: post.id,
            title: post.title || post.id,
            content: fullContent.content || '',
            updatedAt: fullContent.updatedAt || post.updatedAt || new Date().toISOString(),
            source: 'server'
          });
        } catch (error) {
          logger.warn(`문서 ${post.id} 가져오기 실패:`, error);
          // 실패한 경우 기본 정보만 사용
          fullDocuments.push({
            id: post.id,
            title: post.title || post.id,
            content: post.preview || '',
            updatedAt: post.updatedAt || new Date().toISOString(),
            source: 'server'
          });
        }
      }

      return fullDocuments;
    } catch (error) {
      logger.error('서버 문서 조회 오류:', error);
      return [];
    }
  }

  /**
   * 서버에서 특정 문서의 전체 내용 가져오기
   */
  async getServerDocument(id) {
    const response = await fetch(`${this.serverUrl}/${id}`);
    if (!response.ok) {
      throw new Error(`문서 조회 실패: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * 로컬 스토리지에서 모든 문서 가져오기
   */
  getLocalDocuments() {
    const documents = [];
    const documentKeys = Object.keys(localStorage).filter(key => key.startsWith('miki_document_'));

    for (const key of documentKeys) {
      try {
        const docData = JSON.parse(localStorage.getItem(key));
        if (docData && docData.title) {
          documents.push({
            id: docData.id || key.replace('miki_document_', ''),
            title: docData.title,
            content: docData.content || '',
            updatedAt: docData.updatedAt || new Date().toISOString(),
            source: 'local'
          });
        }
      } catch (e) {
        logger.warn(`로컬 문서 파싱 오류 (${key}):`, e);
      }
    }

    return documents;
  }

  /**
   * 서버에서 불필요한 문서 삭제
   */
  async cleanupServerDocuments(serverDocs, keepTitles) {
    const toDelete = serverDocs.filter(doc =>
      !keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
    );

    let deleted = 0;
    for (const doc of toDelete) {
      try {
        const response = await fetch(`${this.serverUrl}/${doc.id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          deleted++;
          logger.info(`서버에서 삭제: ${doc.title}`);
        }
      } catch (error) {
        logger.error(`서버 삭제 실패 (${doc.title}):`, error);
      }
    }

    return { deleted, total: toDelete.length };
  }

  /**
   * 로컬 스토리지에서 불필요한 문서 삭제
   */
  cleanupLocalDocuments(localDocs, keepTitles) {
    const toDelete = localDocs.filter(doc =>
      !keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
    );

    let deleted = 0;
    for (const doc of toDelete) {
      try {
        localStorage.removeItem(`miki_document_${doc.id}`);
        localStorage.removeItem(`miki_title_${doc.id}`);
        deleted++;
        logger.info(`로컬에서 삭제: ${doc.title}`);
      } catch (error) {
        logger.error(`로컬 삭제 실패 (${doc.title}):`, error);
      }
    }

    return { deleted, total: toDelete.length };
  }

  /**
   * 서버와 로컬 문서를 최신 버전으로 통합
   */
  async mergeDocuments(serverDocs, localDocs) {
    const finalDocuments = [];
    const titleGroups = {};

    // 제목별로 그룹화
    [...serverDocs, ...localDocs].forEach(doc => {
      const titleKey = doc.title.toLowerCase();
      if (!titleGroups[titleKey]) {
        titleGroups[titleKey] = [];
      }
      titleGroups[titleKey].push(doc);
    });

    // 각 제목별로 최신 버전 선택 및 동기화
    for (const [titleKey, docs] of Object.entries(titleGroups)) {
      // 최신 문서 선택 (updatedAt 기준)
      const latestDoc = docs.sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];

      // 서버와 로컬 모두에 최신 버전 저장
      await this.saveToServer(latestDoc);
      this.saveToLocal(latestDoc);

      finalDocuments.push(latestDoc);
      logger.info(`통합 완료: ${latestDoc.title} (최신: ${latestDoc.updatedAt})`);
    }

    return { merged: finalDocuments.length, finalDocuments };
  }

  /**
   * 서버에 문서 저장 (수정: 서버 API 구조에 맞게 개선)
   */
  async saveToServer(doc) {
    try {
      // 먼저 해당 ID의 문서가 서버에 존재하는지 확인
      const existingResponse = await fetch(`${this.serverUrl}/${doc.id}`);

      if (existingResponse.ok) {
        // 문서가 존재하면 PUT으로 업데이트
        const updateResponse = await fetch(`${this.serverUrl}/${doc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: doc.content,
            title: doc.title
          })
        });

        if (!updateResponse.ok) {
          throw new Error(`서버 업데이트 실패: ${updateResponse.status}`);
        }

        logger.info(`✅ 서버 업데이트 완료: ${doc.title}`);
      } else {
        // 문서가 없으면 POST로 새로 생성
        const createResponse = await fetch(this.serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: doc.title,
            content: doc.content
          })
        });

        if (!createResponse.ok) {
          throw new Error(`서버 생성 실패: ${createResponse.status}`);
        }

        const result = await createResponse.json();
        logger.info(`✅ 서버 생성 완료: ${doc.title} (ID: ${result.id})`);

        // 새로 생성된 ID가 다르면 로컬에서도 업데이트
        if (result.id !== doc.id) {
          logger.info(`🔄 ID 변경: ${doc.id} → ${result.id}`);

          // 기존 로컬 데이터 삭제
          localStorage.removeItem(`miki_document_${doc.id}`);
          localStorage.removeItem(`miki_title_${doc.id}`);

          // 새 ID로 저장
          doc.id = result.id;
          this.saveToLocal(doc);
        }
      }
    } catch (error) {
      logger.error(`서버 저장 오류 (${doc.title}):`, error);
      throw error; // 에러를 상위로 전파
    }
  }

  /**
   * 로컬 스토리지에 문서 저장
   */
  saveToLocal(doc) {
    try {
      const docKey = `miki_document_${doc.id}`;
      const titleKey = `miki_title_${doc.id}`;

      localStorage.setItem(docKey, JSON.stringify({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        updatedAt: doc.updatedAt || new Date().toISOString()
      }));

      localStorage.setItem(titleKey, doc.title);
    } catch (error) {
      logger.error(`로컬 저장 오류 (${doc.title}):`, error);
    }
  }

  /**
   * 최근 문서 목록 재구성
   */
  updateRecentDocuments(documents) {
    try {
      const recentDocs = documents
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 20)
        .map(doc => ({
          id: doc.id,
          title: doc.title,
          updatedAt: doc.updatedAt
        }));

      localStorage.setItem('miki_recent_docs', JSON.stringify(recentDocs));
      logger.info(`최근 문서 목록 업데이트: ${recentDocs.length}개`);
    } catch (error) {
      logger.error('최근 문서 목록 업데이트 오류:', error);
    }
  }

  /**
   * 즉시 로컬 스토리지 정리 (UI에서 호출용)
   * @param {Array} keepTitles - 보존할 문서 제목 배열
   * @returns {Object} - 정리 결과
   */
  immediateLocalCleanup(keepTitles = ['제니', '로제', '먐시리', '블랙핑크']) {
    logger.info('=== 즉시 로컬 스토리지 정리 시작 ===');
    logger.info(`보존할 문서: ${keepTitles.join(', ')}`);

    const stats = {
      totalDocuments: 0,
      preservedDocuments: 0,
      deletedDocuments: 0,
      spaceSaved: 0
    };

    try {
      // 모든 문서 키 수집
      const documentKeys = Object.keys(localStorage).filter(key => key.startsWith('miki_document_'));
      stats.totalDocuments = documentKeys.length;

      logger.info(`📊 총 ${documentKeys.length}개 문서 발견`);

      const toDelete = [];
      const toKeep = [];

      // 제목별 그룹화 및 분류
      const titleGroups = {};

      for (const key of documentKeys) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));
          if (!docData || !docData.title) continue;

          const title = docData.title.toLowerCase();
          const shouldKeep = keepTitles.some(keepTitle =>
            title === keepTitle.toLowerCase()
          );

          if (shouldKeep) {
            if (!titleGroups[title]) {
              titleGroups[title] = [];
            }
            titleGroups[title].push({ key, data: docData });
          } else {
            toDelete.push({ key, title: docData.title });
          }
        } catch (e) {
          // 파싱 오류가 있는 문서는 삭제
          toDelete.push({ key, title: '파싱 오류' });
        }
      }

      // 각 제목별로 최신 버전만 보존
      for (const [title, docs] of Object.entries(titleGroups)) {
        if (docs.length > 1) {
          // 최신 문서 선택
          const latest = docs.sort((a, b) =>
            new Date(b.data.updatedAt || 0) - new Date(a.data.updatedAt || 0)
          )[0];

          // 나머지는 삭제 목록에 추가
          docs.forEach(doc => {
            if (doc.key !== latest.key) {
              toDelete.push({ key: doc.key, title: doc.data.title });
            } else {
              toKeep.push({ key: doc.key, title: doc.data.title });
            }
          });
        } else {
          toKeep.push({ key: docs[0].key, title: docs[0].data.title });
        }
      }

      // 삭제 실행
      for (const item of toDelete) {
        try {
          const docId = item.key.replace('miki_document_', '');
          localStorage.removeItem(item.key);
          localStorage.removeItem(`miki_title_${docId}`);
          stats.deletedDocuments++;
          logger.info(`❌ 삭제: ${item.key} - "${item.title}"`);
        } catch (e) {
          logger.error(`삭제 실패: ${item.key}`, e);
        }
      }

      stats.preservedDocuments = toKeep.length;

      // 보존된 문서 로그
      toKeep.forEach(item => {
        logger.info(`✅ 보존: ${item.key} - "${item.title}"`);
      });

      logger.info('=== 즉시 로컬 스토리지 정리 완료 ===');
      logger.info(`보존: ${stats.preservedDocuments}개, 삭제: ${stats.deletedDocuments}개`);

      return stats;
    } catch (error) {
      logger.error('즉시 정리 오류:', error);
      return { ...stats, error: error.message };
    }
  }

  /**
   * 안전한 동기화 테스트 (실제 변경 없이 시뮬레이션만)
   * @param {Array} keepTitles - 보존할 문서 제목 배열
   * @returns {Object} - 테스트 결과
   */
  async safeTestSync(keepTitles = ['제니', '로제', '먐시리', '블랙핑크']) {
    logger.info('=== 안전한 동기화 테스트 시작 (실제 변경 없음) ===');

    try {
      // 1단계: 현재 상태 분석
      const serverDocs = await this.getServerDocuments();
      const localDocs = this.getLocalDocuments();

      logger.info(`📊 현재 상태: 서버 ${serverDocs.length}개, 로컬 ${localDocs.length}개`);

      // 2단계: 필터링 시뮬레이션
      const serverFiltered = serverDocs.filter(doc =>
        keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
      );
      const localFiltered = localDocs.filter(doc =>
        keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
      );

      // 3단계: 삭제 대상 분석
      const serverToDelete = serverDocs.filter(doc =>
        !keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
      );
      const localToDelete = localDocs.filter(doc =>
        !keepTitles.some(title => title.toLowerCase() === doc.title.toLowerCase())
      );

      // 4단계: 통합 시뮬레이션
      const titleGroups = {};
      [...serverFiltered, ...localFiltered].forEach(doc => {
        const titleKey = doc.title.toLowerCase();
        if (!titleGroups[titleKey]) {
          titleGroups[titleKey] = [];
        }
        titleGroups[titleKey].push(doc);
      });

      const mergeResults = [];
      for (const [titleKey, docs] of Object.entries(titleGroups)) {
        const latest = docs.sort((a, b) =>
          new Date(b.updatedAt) - new Date(a.updatedAt)
        )[0];
        mergeResults.push({
          title: latest.title,
          selectedSource: latest.source,
          versions: docs.length,
          latestUpdate: latest.updatedAt
        });
      }

      const testResult = {
        success: true,
        currentState: {
          server: serverDocs.length,
          local: localDocs.length
        },
        afterFiltering: {
          server: serverFiltered.length,
          local: localFiltered.length
        },
        toDelete: {
          server: serverToDelete.length,
          local: localToDelete.length
        },
        finalMerged: mergeResults.length,
        mergeDetails: mergeResults,
        message: `테스트 완료: ${mergeResults.length}개 문서가 최종 보존됩니다`
      };

      logger.info('=== 안전한 동기화 테스트 완료 ===');
      logger.info('📊 테스트 결과:', testResult);

      return testResult;

    } catch (error) {
      logger.error('동기화 테스트 오류:', error);
      return {
        success: false,
        error: error.message,
        message: '테스트 실패'
      };
    }
  }

  /**
   * 현재 동기화 상태 진단
   */
  async diagnoseCurrentState() {
    logger.info('=== 동기화 상태 진단 시작 ===');

    try {
      const serverDocs = await this.getServerDocuments();
      const localDocs = this.getLocalDocuments();

      // 제목별 그룹화
      const serverTitles = new Set(serverDocs.map(doc => doc.title.toLowerCase()));
      const localTitles = new Set(localDocs.map(doc => doc.title.toLowerCase()));

      const onlyServer = serverDocs.filter(doc =>
        !localTitles.has(doc.title.toLowerCase())
      );
      const onlyLocal = localDocs.filter(doc =>
        !serverTitles.has(doc.title.toLowerCase())
      );
      const both = serverDocs.filter(doc =>
        localTitles.has(doc.title.toLowerCase())
      );

      const diagnosis = {
        server: {
          total: serverDocs.length,
          titles: Array.from(serverTitles)
        },
        local: {
          total: localDocs.length,
          titles: Array.from(localTitles)
        },
        discrepancies: {
          onlyServer: onlyServer.length,
          onlyLocal: onlyLocal.length,
          both: both.length
        },
        details: {
          onlyServerDocs: onlyServer.map(doc => ({ id: doc.id, title: doc.title })),
          onlyLocalDocs: onlyLocal.map(doc => ({ id: doc.id, title: doc.title })),
          sharedDocs: both.map(doc => ({ id: doc.id, title: doc.title }))
        }
      };

      logger.info('📊 진단 완료:', diagnosis);
      return diagnosis;

    } catch (error) {
      logger.error('진단 오류:', error);
      return { error: error.message };
    }
  }
}

export default DataSyncManager; 