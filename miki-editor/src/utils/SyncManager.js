import { createLogger } from '../utils/logger';
const logger = createLogger('SyncManager');
/**
 * 로컬 스토리지와 서버 간의 동기화 및 매핑 오류 해결을 담당하는 클래스
 * 기존 DataSyncManager와 달리 안전하고 점진적인 동기화를 수행
 */
class SyncManager {
  constructor() {
    this.serverUrl = 'http://localhost:3003/api/posts';
    this.syncInProgress = false;
    this.backupKey = `miki_sync_backup_${Date.now()}`;
  }

  /**
   * 1단계: 현재 상황 진단
   * @returns {Object} - 진단 결과
   */
  async diagnoseCurrentState() {
    logger.info('=== 현재 상황 진단 시작 ===');
    
    const diagnosis = {
      local: {
        documents: [],
        totalCount: 0,
        duplicates: {},
        issues: []
      },
      server: {
        documents: [],
        totalCount: 0,
        accessible: false
      },
      mapping: {
        conflicts: [],
        orphans: []
      }
    };

    try {
      // 로컬 스토리지 분석
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('miki_document_'));
      diagnosis.local.totalCount = localKeys.length;
      
      logger.info(`📱 로컬 스토리지: ${localKeys.length}개 문서 발견`);
      
      const titleGroups = {};
      
      for (const key of localKeys) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));
          const docId = key.replace('miki_document_', '');
          
          if (!docData || !docData.title) {
            diagnosis.local.issues.push(`${key}: 제목 없음`);
            continue;
          }
          
          const doc = {
            id: docId,
            title: docData.title,
            content: docData.content || '',
            updatedAt: docData.updatedAt || new Date().toISOString(),
            storageKey: key,
            contentLength: (docData.content || '').length
          };
          
          diagnosis.local.documents.push(doc);
          
          // 제목별 그룹화 (중복 검사)
          const titleKey = docData.title.toLowerCase();
          if (!titleGroups[titleKey]) {
            titleGroups[titleKey] = [];
          }
          titleGroups[titleKey].push(doc);
          
        } catch (e) {
          diagnosis.local.issues.push(`${key}: 파싱 오류 - ${e.message}`);
        }
      }
      
      // 중복 문서 찾기
      for (const [title, docs] of Object.entries(titleGroups)) {
        if (docs.length > 1) {
          diagnosis.local.duplicates[title] = docs.map(d => ({
            id: d.id,
            updatedAt: d.updatedAt,
            contentLength: d.contentLength
          }));
        }
      }
      
      logger.info(`📊 로컬 분석 완료: ${diagnosis.local.documents.length}개 유효, ${Object.keys(diagnosis.local.duplicates).length}개 제목에 중복`);
      
      // 서버 상태 확인
      try {
        const response = await fetch(this.serverUrl);
        if (response.ok) {
          const serverDocs = await response.json();
          diagnosis.server.accessible = true;
          diagnosis.server.totalCount = serverDocs.length;
          diagnosis.server.documents = serverDocs.map(doc => ({
            id: doc.id,
            title: doc.title,
            preview: doc.preview || '',
            updatedAt: doc.updatedAt,
            filename: doc.filename
          }));
          
          logger.info(`🌐 서버 분석 완료: ${serverDocs.length}개 문서`);
        } else {
          diagnosis.server.accessible = false;
          logger.warn('⚠️ 서버에 접근할 수 없습니다');
        }
      } catch (error) {
        diagnosis.server.accessible = false;
        logger.error('❌ 서버 연결 실패:', error.message);
      }
      
      // 매핑 충돌 분석
      if (diagnosis.server.accessible) {
        for (const localDoc of diagnosis.local.documents) {
          const serverDoc = diagnosis.server.documents.find(s => s.id === localDoc.id);
          const serverDocByTitle = diagnosis.server.documents.find(s => 
            s.title.toLowerCase() === localDoc.title.toLowerCase()
          );
          
          if (serverDoc && serverDocByTitle && serverDoc.id !== serverDocByTitle.id) {
            diagnosis.mapping.conflicts.push({
              localDoc,
              serverDocById: serverDoc,
              serverDocByTitle: serverDocByTitle
            });
          }
          
          if (!serverDoc && !serverDocByTitle) {
            diagnosis.mapping.orphans.push(localDoc);
          }
        }
      }
      
      logger.info('=== 진단 완료 ===');
      return diagnosis;
      
    } catch (error) {
      logger.error('진단 중 오류:', error);
      return diagnosis;
    }
  }

  /**
   * 2단계: 백업 생성
   * @param {Object} diagnosis - 진단 결과
   * @returns {boolean} - 백업 성공 여부
   */
  createBackup(diagnosis) {
    try {
      logger.info('=== 백업 생성 시작 ===');
      
      const backup = {
        timestamp: new Date().toISOString(),
        diagnosis,
        localStorage: {}
      };
      
      // 모든 miki 관련 로컬 스토리지 데이터 백업
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('miki_')) {
          backup.localStorage[key] = localStorage.getItem(key);
        }
      }
      
      localStorage.setItem(this.backupKey, JSON.stringify(backup));
      logger.info(`✅ 백업 완료: ${this.backupKey}`);
      logger.info(`📦 백업 크기: ${Object.keys(backup.localStorage).length}개 항목`);
      
      return true;
    } catch (error) {
      logger.error('❌ 백업 생성 실패:', error);
      return false;
    }
  }

  /**
   * 3단계: 로컬 중복 문서 정리
   * @param {Object} diagnosis - 진단 결과
   * @param {Array} keepTitles - 보존할 문서 제목들
   * @returns {Object} - 정리 결과
   */
  cleanupLocalDuplicates(diagnosis, keepTitles = ['제니', '로제', '먐시리', '블랙핑크']) {
    logger.info('=== 로컬 중복 문서 정리 시작 ===');
    
    const result = {
      preserved: [],
      removed: [],
      errors: []
    };
    
    try {
      // 제목별로 그룹화
      const titleGroups = {};
      for (const doc of diagnosis.local.documents) {
        const titleKey = doc.title.toLowerCase();
        if (!titleGroups[titleKey]) {
          titleGroups[titleKey] = [];
        }
        titleGroups[titleKey].push(doc);
      }
      
      for (const [titleKey, docs] of Object.entries(titleGroups)) {
        const shouldKeep = keepTitles.some(keepTitle => 
          titleKey === keepTitle.toLowerCase()
        );
        
        if (!shouldKeep) {
          // 보존하지 않을 문서들은 모두 삭제
          for (const doc of docs) {
            try {
              localStorage.removeItem(doc.storageKey);
              localStorage.removeItem(`miki_title_${doc.id}`);
              result.removed.push(doc);
              logger.info(`❌ 삭제: ${doc.title} (보존 목록에 없음)`);
            } catch (e) {
              result.errors.push(`삭제 실패: ${doc.title} - ${e.message}`);
            }
          }
        } else if (docs.length > 1) {
          // 보존할 문서 중 중복이 있는 경우: 최신 버전만 유지
          docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          const latest = docs[0];
          const duplicates = docs.slice(1);
          
          result.preserved.push(latest);
          logger.info(`✅ 보존: ${latest.title} (최신 버전)`);
          
          for (const duplicate of duplicates) {
            try {
              localStorage.removeItem(duplicate.storageKey);
              localStorage.removeItem(`miki_title_${duplicate.id}`);
              result.removed.push(duplicate);
              logger.info(`❌ 삭제: ${duplicate.title} (중복 버전)`);
            } catch (e) {
              result.errors.push(`중복 삭제 실패: ${duplicate.title} - ${e.message}`);
            }
          }
        } else {
          // 보존할 문서 중 중복이 없는 경우
          result.preserved.push(docs[0]);
          logger.info(`✅ 보존: ${docs[0].title}`);
        }
      }
      
      logger.info(`=== 로컬 정리 완료: 보존 ${result.preserved.length}개, 삭제 ${result.removed.length}개 ===`);
      return result;
      
    } catch (error) {
      logger.error('로컬 정리 중 오류:', error);
      result.errors.push(`정리 오류: ${error.message}`);
      return result;
    }
  }

  /**
   * 4단계: 서버와 로컬 매핑 수정
   * @param {Object} diagnosis - 진단 결과
   * @returns {Object} - 매핑 수정 결과
   */
  async fixServerLocalMapping(diagnosis) {
    if (!diagnosis.server.accessible) {
      logger.info('⚠️ 서버에 접근할 수 없어 매핑 수정을 건너뜁니다');
      return { success: false, reason: 'Server not accessible' };
    }
    
    logger.info('=== 서버-로컬 매핑 수정 시작 ===');
    
    const result = {
      synced: [],
      conflicts: [],
      errors: []
    };
    
    try {
      // 현재 로컬에 남아있는 문서들 다시 확인
      const currentLocalDocs = [];
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('miki_document_'));
      
      for (const key of localKeys) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));
          if (docData && docData.title) {
            currentLocalDocs.push({
              id: key.replace('miki_document_', ''),
              title: docData.title,
              content: docData.content || '',
              updatedAt: docData.updatedAt,
              storageKey: key
            });
          }
        } catch (e) {
          // 파싱 오류 무시
        }
      }
      
      logger.info(`📱 현재 로컬 문서: ${currentLocalDocs.length}개`);
      
      // 각 로컬 문서에 대해 서버와 매핑 확인 및 수정
      for (const localDoc of currentLocalDocs) {
        try {
          // 서버에서 같은 제목의 문서 찾기
          const serverDoc = diagnosis.server.documents.find(s => 
            s.title.toLowerCase() === localDoc.title.toLowerCase()
          );
          
          if (serverDoc) {
            // 서버에 같은 제목의 문서가 있는 경우
            if (serverDoc.id !== localDoc.id) {
              logger.info(`🔄 ID 불일치 수정: "${localDoc.title}" ${localDoc.id} → ${serverDoc.id}`);
              
              // 서버의 최신 내용 가져오기
              const serverContentResponse = await fetch(`${this.serverUrl}/${serverDoc.id}`);
              if (serverContentResponse.ok) {
                const serverContent = await serverContentResponse.json();
                
                // 로컬 스토리지에서 기존 키 삭제
                localStorage.removeItem(localDoc.storageKey);
                localStorage.removeItem(`miki_title_${localDoc.id}`);
                
                // 서버 ID로 새로 저장
                const newKey = `miki_document_${serverDoc.id}`;
                localStorage.setItem(newKey, JSON.stringify({
                  id: serverDoc.id,
                  title: serverContent.title || localDoc.title,
                  content: serverContent.content || localDoc.content,
                  updatedAt: serverContent.updatedAt || localDoc.updatedAt
                }));
                localStorage.setItem(`miki_title_${serverDoc.id}`, serverContent.title || localDoc.title);
                
                result.synced.push({
                  title: localDoc.title,
                  oldId: localDoc.id,
                  newId: serverDoc.id
                });
                
                logger.info(`✅ 매핑 수정 완료: ${localDoc.title}`);
              }
            } else {
              logger.info(`✅ 이미 올바른 매핑: ${localDoc.title}`);
              result.synced.push({
                title: localDoc.title,
                id: localDoc.id,
                status: 'already_correct'
              });
            }
          } else {
            logger.info(`⚠️ 서버에 없는 로컬 문서: ${localDoc.title}`);
            // 필요시 서버에 업로드하거나 로컬에서 제거할 수 있음
          }
          
        } catch (error) {
          logger.error(`❌ 매핑 수정 실패: ${localDoc.title}`, error);
          result.errors.push(`${localDoc.title}: ${error.message}`);
        }
      }
      
      logger.info(`=== 매핑 수정 완료: ${result.synced.length}개 처리 ===`);
      return result;
      
    } catch (error) {
      logger.error('매핑 수정 중 오류:', error);
      result.errors.push(`매핑 수정 오류: ${error.message}`);
      return result;
    }
  }

  /**
   * 5단계: 최근 문서 목록 재구성
   */
  rebuildRecentDocuments() {
    logger.info('=== 최근 문서 목록 재구성 시작 ===');
    
    try {
      const documents = [];
      const localKeys = Object.keys(localStorage).filter(key => key.startsWith('miki_document_'));
      
      for (const key of localKeys) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));
          if (docData && docData.title) {
            documents.push({
              id: docData.id || key.replace('miki_document_', ''),
              title: docData.title,
              updatedAt: docData.updatedAt || new Date().toISOString()
            });
          }
        } catch (e) {
          // 파싱 오류 무시
        }
      }
      
      // 최신순 정렬
      documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      // 최대 20개만 유지
      const recentDocs = documents.slice(0, 20);
      
      localStorage.setItem('miki_recent_docs', JSON.stringify(recentDocs));
      
      logger.info(`✅ 최근 문서 목록 재구성 완료: ${recentDocs.length}개`);
      return recentDocs;
      
    } catch (error) {
      logger.error('최근 문서 목록 재구성 오류:', error);
      return [];
    }
  }

  /**
   * 전체 동기화 실행
   * @param {Array} keepTitles - 보존할 문서 제목들
   * @returns {Object} - 동기화 결과
   */
  async performFullSync(keepTitles = ['제니', '로제', '먐시리', '블랙핑크']) {
    if (this.syncInProgress) {
      return { success: false, message: '동기화가 이미 진행 중입니다' };
    }
    
    this.syncInProgress = true;
    logger.info('🚀 전체 동기화 시작');
    
    try {
      // 1단계: 진단
      const diagnosis = await this.diagnoseCurrentState();
      
      // 2단계: 백업
      const backupSuccess = this.createBackup(diagnosis);
      if (!backupSuccess) {
        throw new Error('백업 생성 실패');
      }
      
      // 3단계: 로컬 정리
      const cleanupResult = this.cleanupLocalDuplicates(diagnosis, keepTitles);
      
      // 4단계: 매핑 수정
      const mappingResult = await this.fixServerLocalMapping(diagnosis);
      
      // 5단계: 최근 문서 목록 재구성
      const recentDocs = this.rebuildRecentDocuments();
      
      const finalResult = {
        success: true,
        diagnosis,
        backup: this.backupKey,
        cleanup: {
          preserved: cleanupResult.preserved.length,
          removed: cleanupResult.removed.length,
          errors: cleanupResult.errors.length
        },
        mapping: {
          synced: mappingResult.synced?.length || 0,
          errors: mappingResult.errors?.length || 0
        },
        recentDocs: recentDocs.length
      };
      
      logger.info('🎉 전체 동기화 완료!');
      logger.info(`📊 결과: 보존 ${finalResult.cleanup.preserved}개, 삭제 ${finalResult.cleanup.removed}개, 매핑 수정 ${finalResult.mapping.synced}개`);
      
      return finalResult;
      
    } catch (error) {
      logger.error('❌ 동기화 실패:', error);
      return {
        success: false,
        message: error.message,
        backup: this.backupKey
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 백업에서 복원
   * @param {string} backupKey - 백업 키 (선택사항, 기본값은 최신 백업)
   */
  restoreFromBackup(backupKey = null) {
    try {
      const useBackupKey = backupKey || this.backupKey;
      const backupData = localStorage.getItem(useBackupKey);
      
      if (!backupData) {
        throw new Error('백업 데이터를 찾을 수 없습니다');
      }
      
      const backup = JSON.parse(backupData);
      
      logger.info('🔄 백업에서 복원 시작...');
      
      // 현재 miki 데이터 모두 삭제
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('miki_') && key !== useBackupKey) {
          localStorage.removeItem(key);
        }
      }
      
      // 백업 데이터 복원
      for (const [key, value] of Object.entries(backup.localStorage)) {
        localStorage.setItem(key, value);
      }
      
      logger.info('✅ 백업 복원 완료');
      return { success: true };
      
    } catch (error) {
      logger.error('❌ 백업 복원 실패:', error);
      return { success: false, message: error.message };
    }
  }
}

export default SyncManager; 