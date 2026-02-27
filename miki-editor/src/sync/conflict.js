import { createLogger } from '../utils/logger';
import { sanitizeHtml } from '../utils/sanitize';
const logger = createLogger('conflict');
/**
 * ConflictResolver - 문서 충돌 해결 모듈
 */
export class ConflictResolver {
  constructor(options = {}) {
    this.strategy = options.strategy || 'last-write-wins';
    this.autoResolve = options.autoResolve !== false;
    this.userPromptTimeout = options.userPromptTimeout || 30000; // 30초
  }
  
  /**
   * 충돌 해결 메인 메서드
   */
  async resolve(conflict) {
    const { documentId, local, server, operation } = conflict;
    
    logger.info(`🔄 충돌 해결 시작: ${documentId} (${operation})`);
    
    try {
      // 1. 자동 해결 가능한지 확인
      const autoResolution = this.tryAutoResolve(local, server, operation);
      
      if (autoResolution && this.autoResolve) {
        logger.info(`✅ 자동 충돌 해결: ${autoResolution.action}`);
        return autoResolution;
      }
      
      // 2. 사용자 개입 필요
      const userResolution = await this.promptUserResolution(conflict);
      
      if (userResolution) {
        logger.info(`✅ 사용자 충돌 해결: ${userResolution.action}`);
        return userResolution;
      }
      
      // 3. 기본 전략 적용
      const fallbackResolution = this.applyFallbackStrategy(local, server, operation);
      logger.info(`⚠️ 기본 전략 적용: ${fallbackResolution.action}`);
      
      return fallbackResolution;
      
    } catch (error) {
      logger.error('❌ 충돌 해결 실패:', error);
      
      // 최후의 수단: 로컬 데이터 유지
      return {
        action: 'use_local',
        data: local,
        reason: '충돌 해결 실패로 인한 로컬 데이터 보존',
        error: error.message
      };
    }
  }
  
  /**
   * 자동 해결 시도
   */
  tryAutoResolve(local, server, operation) {
    // 1. 내용이 동일한 경우
    if (this.isContentEqual(local, server)) {
      return {
        action: 'no_conflict',
        data: local,
        reason: '내용이 동일함'
      };
    }
    
    // 2. 한쪽이 비어있는 경우
    if (this.isEmpty(local) && !this.isEmpty(server)) {
      return {
        action: 'use_server',
        data: server,
        reason: '로컬 데이터가 비어있음'
      };
    }
    
    if (!this.isEmpty(local) && this.isEmpty(server)) {
      return {
        action: 'use_local',
        data: local,
        reason: '서버 데이터가 비어있음'
      };
    }
    
    // 3. 단순 추가만 있는 경우 (텍스트 끝에 내용 추가)
    const mergeResult = this.trySimpleMerge(local, server);
    if (mergeResult) {
      return {
        action: 'merge',
        data: mergeResult,
        reason: '단순 병합 가능'
      };
    }
    
    // 4. 타임스탬프 기반 판단
    if (local.updatedAt && server.updatedAt) {
      const localTime = new Date(local.updatedAt);
      const serverTime = new Date(server.updatedAt);
      const timeDiff = Math.abs(localTime - serverTime);
      
      // 시간 차이가 1초 미만이면 내용 길이로 판단
      if (timeDiff < 1000) {
        const localLength = (local.content || '').length;
        const serverLength = (server.content || '').length;
        
        if (localLength > serverLength) {
          return {
            action: 'use_local',
            data: local,
            reason: '동시 편집 시 더 긴 내용 선택'
          };
        } else {
          return {
            action: 'use_server',
            data: server,
            reason: '동시 편집 시 더 긴 내용 선택'
          };
        }
      }
    }
    
    return null; // 자동 해결 불가
  }
  
  /**
   * 단순 병합 시도
   */
  trySimpleMerge(local, server) {
    const localContent = local.content || '';
    const serverContent = server.content || '';
    
    // 한쪽이 다른 쪽의 부분집합인지 확인
    if (localContent.includes(serverContent)) {
      return {
        ...local,
        content: localContent,
        title: local.title || server.title
      };
    }
    
    if (serverContent.includes(localContent)) {
      return {
        ...server,
        content: serverContent,
        title: server.title || local.title
      };
    }
    
    // 공통 접두사/접미사 찾기
    const commonPrefix = this.findCommonPrefix(localContent, serverContent);
    const commonSuffix = this.findCommonSuffix(localContent, serverContent);
    
    if (commonPrefix.length > 10 || commonSuffix.length > 10) {
      // 간단한 3-way merge 시도
      const localMiddle = localContent.slice(
        commonPrefix.length, 
        localContent.length - commonSuffix.length
      );
      const serverMiddle = serverContent.slice(
        commonPrefix.length, 
        serverContent.length - commonSuffix.length
      );
      
      // 중간 부분을 합치기
      const mergedContent = commonPrefix + localMiddle + '\n' + serverMiddle + commonSuffix;
      
      return {
        ...local,
        content: mergedContent,
        title: local.title || server.title,
        mergedAt: new Date().toISOString()
      };
    }
    
    return null;
  }
  
  /**
   * 사용자 해결 프롬프트
   */
  async promptUserResolution(conflict) {
    return new Promise((resolve) => {
      const { documentId, local, server } = conflict;
      
      // 충돌 해결 UI 표시
      const modal = this.createConflictModal(documentId, local, server);
      document.body.appendChild(modal);
      
      // 타임아웃 설정
      const timeout = setTimeout(() => {
        document.body.removeChild(modal);
        resolve(null); // 타임아웃 시 null 반환
      }, this.userPromptTimeout);
      
      // 사용자 선택 처리
      const handleChoice = (choice, data) => {
        clearTimeout(timeout);
        document.body.removeChild(modal);
        resolve({
          action: choice,
          data: data,
          reason: '사용자 선택'
        });
      };
      
      // 버튼 이벤트 리스너
      modal.querySelector('.use-local').onclick = () => 
        handleChoice('use_local', local);
      
      modal.querySelector('.use-server').onclick = () => 
        handleChoice('use_server', server);
      
      modal.querySelector('.merge-manual').onclick = () => {
        const mergedData = this.showMergeEditor(local, server);
        handleChoice('merge', mergedData);
      };
    });
  }
  
  /**
   * 충돌 해결 모달 생성
   */
  createConflictModal(documentId, local, server) {
    const modal = document.createElement('div');
    modal.className = 'conflict-resolution-modal';

    // XSS 방지: 사용자 입력 데이터 정제
    const safeTitle = sanitizeHtml(local.title || documentId);
    const safeLocalContent = sanitizeHtml(this.truncateContent(local.content));
    const safeServerContent = sanitizeHtml(this.truncateContent(server.content));

    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h3>📄 문서 충돌 감지</h3>
          <p>문서 "${safeTitle}"에서 충돌이 발생했습니다.</p>

          <div class="conflict-comparison">
            <div class="local-version">
              <h4>🖥️ 로컬 버전</h4>
              <div class="content-preview">${safeLocalContent}</div>
              <small>수정: ${new Date(local.updatedAt).toLocaleString()}</small>
            </div>

            <div class="server-version">
              <h4>☁️ 서버 버전</h4>
              <div class="content-preview">${safeServerContent}</div>
              <small>수정: ${new Date(server.updatedAt).toLocaleString()}</small>
            </div>
          </div>
          
          <div class="resolution-buttons">
            <button class="use-local">로컬 버전 사용</button>
            <button class="use-server">서버 버전 사용</button>
            <button class="merge-manual">수동 병합</button>
          </div>
          
          <p class="timeout-warning">30초 후 자동으로 로컬 버전이 선택됩니다.</p>
        </div>
      </div>
    `;
    
    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
      .conflict-resolution-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      .modal-overlay {
        background: rgba(0,0,0,0.7);
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-content {
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .conflict-comparison {
        display: flex;
        gap: 20px;
        margin: 20px 0;
      }
      .local-version, .server-version {
        flex: 1;
        border: 1px solid #ddd;
        padding: 10px;
        border-radius: 4px;
      }
      .content-preview {
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        max-height: 150px;
        overflow-y: auto;
        white-space: pre-wrap;
      }
      .resolution-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin: 20px 0;
      }
      .resolution-buttons button {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .use-local { background: #4CAF50; color: white; }
      .use-server { background: #2196F3; color: white; }
      .merge-manual { background: #FF9800; color: white; }
      .timeout-warning {
        text-align: center;
        color: #666;
        font-size: 12px;
      }
    `;
    modal.appendChild(style);
    
    return modal;
  }
  
  /**
   * 기본 전략 적용
   */
  applyFallbackStrategy(local, server, operation) {
    switch (this.strategy) {
      case 'last-write-wins': {
        const localTime = new Date(local.updatedAt || 0);
        const serverTime = new Date(server.updatedAt || 0);
        
        return localTime >= serverTime ? {
          action: 'use_local',
          data: local,
          reason: 'Last-Write-Wins: 로컬이 더 최신'
        } : {
          action: 'use_server',
          data: server,
          reason: 'Last-Write-Wins: 서버가 더 최신'
        };
      }
      
      case 'prefer-local':
        return {
          action: 'use_local',
          data: local,
          reason: 'Prefer-Local 전략'
        };
        
      case 'prefer-server':
        return {
          action: 'use_server',
          data: server,
          reason: 'Prefer-Server 전략'
        };
        
      default:
        return {
          action: 'use_local',
          data: local,
          reason: '알 수 없는 전략으로 인한 로컬 선택'
        };
    }
  }
  
  /**
   * 유틸리티 메서드들
   */
  isContentEqual(local, server) {
    return (local.content || '').trim() === (server.content || '').trim() &&
           (local.title || '').trim() === (server.title || '').trim();
  }
  
  isEmpty(data) {
    return !data || 
           (!data.content || data.content.trim() === '') &&
           (!data.title || data.title.trim() === '');
  }
  
  findCommonPrefix(str1, str2) {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.slice(0, i);
  }
  
  findCommonSuffix(str1, str2) {
    let i = 0;
    while (i < str1.length && i < str2.length && 
           str1[str1.length - 1 - i] === str2[str2.length - 1 - i]) {
      i++;
    }
    return str1.slice(str1.length - i);
  }
  
  truncateContent(content, maxLength = 200) {
    if (!content) return '(내용 없음)';
    return content.length > maxLength ? 
           content.slice(0, maxLength) + '...' : 
           content;
  }
}

/**
 * 충돌 해결기 팩토리
 */
export const createConflictResolver = (options = {}) => {
  return new ConflictResolver(options);
};

/**
 * 기본 충돌 해결기 인스턴스
 */
export const defaultConflictResolver = new ConflictResolver(); 