import { createLogger } from '../utils/logger';
const logger = createLogger('featureFlags');
/**
 * 기능 플래그 관리
 * 점진적 배포와 A/B 테스트를 위한 중앙화된 설정
 */

// 환경 변수에서 기능 플래그 읽기
const getFeatureFlag = (flagName, defaultValue = false) => {
  // Jest 호환성을 위해 기본값 사용
  return defaultValue;
};

// 사용자별 기능 플래그 (localStorage 기반)
const getUserFeatureFlag = (flagName, defaultValue = false) => {
  try {
    const userFlags = JSON.parse(localStorage.getItem('userFeatureFlags') || '{}');
    return userFlags[flagName] !== undefined ? userFlags[flagName] : defaultValue;
  } catch {
    return defaultValue;
  }
};

// 기능 플래그 설정
export const FEATURE_FLAGS = {
  // AI 기능 관련
  AI_PANEL: getFeatureFlag('AI_PANEL', true),
  AI_SEARCH: getFeatureFlag('AI_SEARCH', true),
  AI_SUMMARY: getFeatureFlag('AI_SUMMARY', true),
  
  // 에디터 기능 관련
  MARKDOWN_PREVIEW: getFeatureFlag('MARKDOWN_PREVIEW', true),
  SYNTAX_HIGHLIGHTING: getFeatureFlag('SYNTAX_HIGHLIGHTING', true),
  AUTO_SAVE: getFeatureFlag('AUTO_SAVE', true),
  
  // 동기화 기능 관련
  SERVER_SYNC: getFeatureFlag('SERVER_SYNC', true),
  REAL_TIME_SYNC: getFeatureFlag('REAL_TIME_SYNC', false),
  
  // 실험적 기능들
  EXPERIMENTAL_FEATURES: getFeatureFlag('EXPERIMENTAL_FEATURES', false),
  BETA_UI: getFeatureFlag('BETA_UI', false),
  
  // 디버그 및 개발 관련
  DEBUG_MODE: getFeatureFlag('DEBUG_MODE', false),
  PERFORMANCE_MONITORING: getFeatureFlag('PERFORMANCE_MONITORING', false),
  
  // 환경 정보
  DEV_MODE: false, // Jest 환경에서는 false
  
  // 새로운 기능들
  DOCUMENT_VERSIONING: getFeatureFlag('DOCUMENT_VERSIONING', false),
  COLLABORATIVE_EDITING: getFeatureFlag('COLLABORATIVE_EDITING', false),
  ADVANCED_SEARCH: getFeatureFlag('ADVANCED_SEARCH', true),
  EXPORT_FEATURES: getFeatureFlag('EXPORT_FEATURES', true),
};

// 기능 플래그 업데이트 함수
export const updateUserFeatureFlag = (flagName, value) => {
  try {
    const userFlags = JSON.parse(localStorage.getItem('userFeatureFlags') || '{}');
    userFlags[flagName] = value;
    localStorage.setItem('userFeatureFlags', JSON.stringify(userFlags));
    
    // 페이지 새로고침 없이 즉시 적용하려면 이벤트 발생
    window.dispatchEvent(new CustomEvent('featureFlagChanged', {
      detail: { flagName, value }
    }));
    
    return true;
  } catch (error) {
    logger.error('Failed to update feature flag:', error);
    return false;
  }
};

// 기능 플래그 상태 확인 헬퍼
export const isFeatureEnabled = (flagName) => {
  return FEATURE_FLAGS[flagName] === true;
};

// 개발자 도구용 기능 플래그 디버거
if (FEATURE_FLAGS.DEV_MODE) {
  window.mikiFeatureFlags = {
    flags: FEATURE_FLAGS,
    enable: (flagName) => updateUserFeatureFlag(flagName, true),
    disable: (flagName) => updateUserFeatureFlag(flagName, false),
    toggle: (flagName) => {
      const current = getUserFeatureFlag(flagName, false);
      return updateUserFeatureFlag(flagName, !current);
    },
    reset: () => {
      localStorage.removeItem('userFeatureFlags');
      window.location.reload();
    }
  };
  
  logger.info('🚩 Feature Flags Debug Tools:', window.mikiFeatureFlags);
}

// 기능 플래그별 컴포넌트 래퍼
export const FeatureGate = ({ feature, children, fallback = null }) => {
  return isFeatureEnabled(feature) ? children : fallback;
};

// 점진적 마이그레이션을 위한 컴포넌트 선택기
export const ComponentSelector = ({ 
  feature, 
  newComponent: NewComponent, 
  legacyComponent: LegacyComponent,
  ...props 
}) => {
  const Component = isFeatureEnabled(feature) ? NewComponent : LegacyComponent;
  return <Component {...props} />;
};

export default FEATURE_FLAGS; 