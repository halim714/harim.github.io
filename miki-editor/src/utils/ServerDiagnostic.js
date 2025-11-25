import { createLogger } from '../utils/logger';
const logger = createLogger('ServerDiagnostic');
/**
 * 서버와 로컬 스토리지의 상세한 차이점을 분석하는 진단 도구
 */
class ServerDiagnostic {
  constructor() {
    this.serverUrl = 'http://localhost:3003/api/posts';
  }

  /**
   * 서버와 로컬의 상세한 차이점 분석
   */
  async analyzeDiscrepancies() {
    logger.info('🔍 === 서버-로컬 불일치 분석 시작 ===');

    try {
      // 1. 서버 문서 목록 가져오기
      const serverResponse = await fetch(this.serverUrl);
      const serverDocs = await serverResponse.json();

      // 2. 로컬 문서 목록 가져오기
      const localDocs = this.getLocalDocuments();

      logger.info(`📊 서버: ${serverDocs.length}개, 로컬: ${localDocs.length}개`);

      // 3. 서버 문서 상세 분석
      logger.info('\n🌐 === 서버 문서 목록 ===');
      const serverTitles = new Set();
      const serverById = new Map();

      serverDocs.forEach((doc, index) => {
        logger.info(`${index + 1}. ID: "${doc.id}" | 제목: "${doc.title}" | 크기: ${doc.content?.length || 0}자`);
        serverTitles.add(doc.title);
        serverById.set(doc.id, doc);
      });

      // 4. 로컬 문서 상세 분석
      logger.info('\n📱 === 로컬 문서 목록 ===');
      const localTitles = new Set();
      const localById = new Map();

      localDocs.forEach((doc, index) => {
        logger.info(`${index + 1}. ID: "${doc.id}" | 제목: "${doc.title}" | 크기: ${doc.content?.length || 0}자`);
        localTitles.add(doc.title);
        localById.set(doc.id, doc);
      });

      // 5. 차이점 분석
      logger.info('\n❌ === 차이점 분석 ===');

      // 서버에만 있는 문서
      const serverOnlyTitles = [...serverTitles].filter(title => !localTitles.has(title));
      const serverOnlyIds = serverDocs.filter(doc => !localById.has(doc.id));

      // 로컬에만 있는 문서
      const localOnlyTitles = [...localTitles].filter(title => !serverTitles.has(title));
      const localOnlyIds = localDocs.filter(doc => !serverById.has(doc.id));

      logger.info(`🌐 서버에만 있는 제목: ${serverOnlyTitles.length}개`);
      serverOnlyTitles.forEach(title => logger.info(`  - "${title}"`));

      logger.info(`🌐 서버에만 있는 ID: ${serverOnlyIds.length}개`);
      serverOnlyIds.forEach(doc => logger.info(`  - ID: "${doc.id}" | 제목: "${doc.title}"`));

      logger.info(`📱 로컬에만 있는 제목: ${localOnlyTitles.length}개`);
      localOnlyTitles.forEach(title => logger.info(`  - "${title}"`));

      logger.info(`📱 로컬에만 있는 ID: ${localOnlyIds.length}개`);
      localOnlyIds.forEach(doc => logger.info(`  - ID: "${doc.id}" | 제목: "${doc.title}"`));

      // 6. 제목은 같지만 ID가 다른 문서들 찾기
      logger.info('\n🔄 === 제목은 같지만 ID가 다른 문서들 ===');
      const titleConflicts = [];

      serverDocs.forEach(serverDoc => {
        const sameTitle = localDocs.filter(localDoc =>
          localDoc.title === serverDoc.title && localDoc.id !== serverDoc.id
        );

        if (sameTitle.length > 0) {
          titleConflicts.push({
            title: serverDoc.title,
            server: serverDoc,
            local: sameTitle
          });
        }
      });

      titleConflicts.forEach(conflict => {
        logger.info(`📝 제목: "${conflict.title}"`);
        logger.info(`  🌐 서버 ID: "${conflict.server.id}"`);
        conflict.local.forEach(local => {
          logger.info(`  📱 로컬 ID: "${local.id}"`);
        });
      });

      // 7. 동기화 제안
      logger.info('\n💡 === 동기화 제안 ===');

      if (serverOnlyIds.length > 0) {
        logger.info(`🔽 서버에서 로컬로 가져올 문서: ${serverOnlyIds.length}개`);
        serverOnlyIds.forEach(doc => {
          logger.info(`  - "${doc.title}" (ID: ${doc.id})`);
        });
      }

      if (localOnlyIds.length > 0) {
        logger.info(`🔼 로컬에서 서버로 업로드할 문서: ${localOnlyIds.length}개`);
        localOnlyIds.forEach(doc => {
          logger.info(`  - "${doc.title}" (ID: ${doc.id})`);
        });
      }

      if (titleConflicts.length > 0) {
        logger.info(`🔧 충돌 해결이 필요한 문서: ${titleConflicts.length}개`);
        titleConflicts.forEach(conflict => {
          logger.info(`  - "${conflict.title}"`);
        });
      }

      return {
        server: {
          docs: serverDocs,
          titles: serverTitles,
          count: serverDocs.length
        },
        local: {
          docs: localDocs,
          titles: localTitles,
          count: localDocs.length
        },
        differences: {
          serverOnly: serverOnlyIds,
          localOnly: localOnlyIds,
          titleConflicts: titleConflicts
        }
      };

    } catch (error) {
      logger.error('❌ 분석 실패:', error);
      return null;
    }
  }

  /**
   * 로컬 스토리지에서 문서 목록 가져오기
   */
  getLocalDocuments() {
    const docs = [];

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('miki_document_')) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));
          docs.push({
            id: docData.id,
            title: docData.title,
            content: docData.content,
            updatedAt: docData.updatedAt
          });
        } catch (error) {
          logger.warn(`⚠️ 로컬 문서 파싱 실패: ${key}`, error);
        }
      }
    });

    return docs;
  }

  /**
   * 자동 동기화 실행 (안전하게)
   */
  async performSafeSync() {
    logger.info('🔄 === 안전한 자동 동기화 시작 ===');

    const analysis = await this.analyzeDiscrepancies();
    if (!analysis) {
      logger.error('❌ 분석 실패로 동기화 중단');
      return false;
    }

    const { differences } = analysis;
    let syncCount = 0;

    try {
      // 1. 서버에만 있는 문서들을 로컬로 가져오기
      for (const serverDoc of differences.serverOnly) {
        logger.info(`🔽 서버에서 가져오기: "${serverDoc.title}"`);

        const localKey = `miki_document_${serverDoc.id}`;
        localStorage.setItem(localKey, JSON.stringify(serverDoc));

        syncCount++;
        logger.info(`✅ 로컬 저장 완료: ${localKey}`);
      }

      // 2. 제목 충돌 해결 (서버 버전을 우선으로)
      for (const conflict of differences.titleConflicts) {
        logger.info(`🔧 충돌 해결: "${conflict.title}"`);

        // 로컬의 구버전 제거
        conflict.local.forEach(localDoc => {
          const oldKey = `miki_document_${localDoc.id}`;
          localStorage.removeItem(oldKey);
          logger.info(`🗑️ 구버전 제거: ${oldKey}`);
        });

        // 서버 버전을 로컬에 저장
        const newKey = `miki_document_${conflict.server.id}`;
        localStorage.setItem(newKey, JSON.stringify(conflict.server));
        logger.info(`✅ 신버전 저장: ${newKey}`);

        syncCount++;
      }

      logger.info(`🎉 동기화 완료: ${syncCount}개 문서 처리`);
      return true;

    } catch (error) {
      logger.error('❌ 동기화 실패:', error);
      return false;
    }
  }
}

// 전역에서 사용할 수 있도록 export
export default ServerDiagnostic; 