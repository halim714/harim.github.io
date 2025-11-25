import { createLogger } from '../utils/logger';
const logger = createLogger('wsAdapter');
/**
 * WebSocketAdapter - 실시간 동기화를 위한 WebSocket 어댑터
 */
export class WebSocketAdapter {
  constructor(options = {}) {
    this.url = options.url || 'ws://localhost:3003/ws';
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;

    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;

    this.listeners = {
      connect: [],
      disconnect: [],
      message: [],
      error: [],
      documentUpdate: [],
      documentDelete: [],
      conflict: []
    };
  }

  /**
   * WebSocket 연결
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info('🔌 WebSocket 이미 연결됨');
      return;
    }

    try {
      logger.info(`🔌 WebSocket 연결 시도: ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      logger.error('❌ WebSocket 연결 실패:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect() {
    logger.info('🔌 WebSocket 연결 해제');

    this.clearTimers();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnect');
      }

      this.ws = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * 메시지 전송
   */
  send(type, data = {}) {
    if (!this.isConnected || !this.ws) {
      logger.warn('⚠️ WebSocket 연결되지 않음, 메시지 전송 실패');
      return false;
    }

    try {
      const message = {
        type,
        data,
        timestamp: new Date().toISOString()
      };

      this.ws.send(JSON.stringify(message));
      logger.info(`📤 WebSocket 메시지 전송: ${type}`, data);
      return true;

    } catch (error) {
      logger.error('❌ WebSocket 메시지 전송 실패:', error);
      return false;
    }
  }

  /**
   * 문서 구독
   */
  subscribeToDocument(documentId) {
    return this.send('subscribe', { documentId });
  }

  /**
   * 문서 구독 해제
   */
  unsubscribeFromDocument(documentId) {
    return this.send('unsubscribe', { documentId });
  }

  /**
   * 문서 변경 알림
   */
  notifyDocumentChange(documentId, changes) {
    return this.send('document_change', {
      documentId,
      changes,
      clientId: this.getClientId()
    });
  }

  /**
   * 연결 상태 확인
   */
  isConnected() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 연결 열림 처리
   */
  handleOpen(event) {
    logger.info('✅ WebSocket 연결 성공');

    this.isConnected = true;
    this.reconnectAttempts = 0;

    this.startHeartbeat();
    this.emit('connect', { event });
  }

  /**
   * 메시지 수신 처리
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      logger.info(`📥 WebSocket 메시지 수신: ${message.type}`, message.data);

      this.emit('message', message);

      // 메시지 타입별 처리
      switch (message.type) {
        case 'document_updated':
          this.emit('documentUpdate', message.data);
          break;

        case 'document_deleted':
          this.emit('documentDelete', message.data);
          break;

        case 'conflict_detected':
          this.emit('conflict', message.data);
          break;

        case 'pong':
          // Heartbeat 응답
          break;

        default:
          logger.info(`🤷 알 수 없는 메시지 타입: ${message.type}`);
      }

    } catch (error) {
      logger.error('❌ WebSocket 메시지 파싱 실패:', error);
    }
  }

  /**
   * 연결 종료 처리
   */
  handleClose(event) {
    logger.info(`🔌 WebSocket 연결 종료: ${event.code} - ${event.reason}`);

    this.isConnected = false;
    this.clearTimers();

    this.emit('disconnect', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    // 비정상 종료인 경우 재연결 시도
    if (event.code !== 1000 && event.code !== 1001) {
      this.scheduleReconnect();
    }
  }

  /**
   * 오류 처리
   */
  handleError(event) {
    logger.error('❌ WebSocket 오류:', event);
    this.emit('error', { event });
  }

  /**
   * 재연결 스케줄링
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`❌ 최대 재연결 시도 횟수(${this.maxReconnectAttempts}) 초과`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 최대 30초
    );

    logger.info(`🔄 ${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Heartbeat 시작
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send('ping');
      }
    }, this.heartbeatInterval);
  }

  /**
   * 타이머 정리
   */
  clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 클라이언트 ID 생성/조회
   */
  getClientId() {
    let clientId = localStorage.getItem('miki_client_id');

    if (!clientId) {
      clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('miki_client_id', clientId);
    }

    return clientId;
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * 이벤트 리스너 제거
   */
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * 이벤트 발생
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`❌ WebSocket 이벤트 리스너 오류 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 연결 상태 정보
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url
    };
  }
}

/**
 * WebSocket 어댑터 팩토리
 */
export const createWebSocketAdapter = (options = {}) => {
  return new WebSocketAdapter(options);
};

/**
 * 기본 WebSocket 어댑터 인스턴스
 */
export const defaultWebSocketAdapter = new WebSocketAdapter(); 