# Miki Editor v7 🚀

> **오프라인 우선 마크다운 위키 에디터** - AI 연동, 실시간 동기화, 현대적 아키텍처

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-repo/miki-editor)
[![Test Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](https://github.com/your-repo/miki-editor)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## ✨ 주요 기능

### 🎯 **핵심 기능**
- 📝 **마크다운 에디터**: Toast UI Editor 기반 WYSIWYG/마크다운 모드
- 🤖 **AI 연동**: Claude API를 통한 글쓰기 지원 및 제안
- 💾 **오프라인 우선**: IndexedDB 기반 로컬 저장, 네트워크 없이도 작동
- 🔄 **실시간 동기화**: 서버와 자동 동기화, 충돌 해결
- 📱 **반응형 디자인**: 모바일/태블릿/데스크톱 최적화

### 🏗️ **아키텍처 특징**
- ⚡ **현대적 상태 관리**: Zustand + TanStack Query
- 🧪 **완전한 테스트 커버리지**: 95개 테스트 (단위/통합/E2E)
- 🔒 **보안 강화**: XSS 방지, 안전한 JSON 파싱
- 📦 **최적화된 번들**: 코드 스플리팅, 지연 로딩
- 🛠️ **개발자 경험**: Hot Reload, DevTools, TypeScript 지원

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 18+ 
- npm 또는 yarn

### 설치 및 실행
```bash
# 저장소 클론
git clone https://github.com/your-repo/miki-editor.git
cd miki-editor

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 백엔드 서버 시작 (별도 터미널)
npm run server
```

### 환경 설정
```bash
# .env 파일 생성
cp .env.example .env

# Claude API 키 설정 (선택사항)
CLAUDE_API_KEY=your_api_key_here
```

## 📋 사용 가능한 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 (포트 3000) |
| `npm run server` | 백엔드 API 서버 시작 (포트 3001) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | 테스트 실행 |
| `npm run test:watch` | 테스트 감시 모드 |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |

## 🏗️ 아키텍처 개요

### 📁 프로젝트 구조
```
src/
├── components/          # React 컴포넌트
│   ├── common/         # 공통 컴포넌트
│   ├── layout/         # 레이아웃 컴포넌트
│   ├── editor/         # 에디터 관련
│   └── ai/             # AI 패널
├── hooks/              # 커스텀 훅
├── stores/             # Zustand 상태 관리
├── utils/              # 유틸리티 함수
├── sync/               # 동기화 모듈
├── config/             # 설정 파일
└── __tests__/          # 테스트 파일
```

### 🔄 데이터 흐름
```
사용자 입력 → Zustand Store → IndexedDB → 서버 동기화
     ↑                                           ↓
UI 업데이트 ← TanStack Query ← 낙관적 업데이트 ←┘
```

## 🧪 테스트

### 테스트 커버리지
- **95개 테스트 통과** ✅
- **단위 테스트**: 훅, 유틸리티, 스토어
- **컴포넌트 테스트**: UI 컴포넌트 렌더링
- **통합 테스트**: 전체 앱 플로우
- **스냅샷 테스트**: UI 일관성 보장

### 테스트 실행
```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일 실행
npm test -- documentFlow.test.jsx

# 커버리지 리포트 생성
npm test -- --coverage
```

## 🔧 개발 가이드

### 상태 관리 패턴
```javascript
// Zustand 스토어 사용
const { currentDocument, setCurrentDocument } = useDocumentStore();

// TanStack Query 사용
const { data: documents, isLoading } = useDocuments();
```

### 커스텀 훅 사용
```javascript
// 자동 저장
const { saveStatus, manualSave } = useAutoSave({
  document: currentDocument,
  content,
  enabled: true
});

// 키보드 단축키
useKeyboardShortcuts({
  onSave: manualSave,
  onNewDocument: createNew,
  disabled: false
});
```

## 🚀 배포

### 프로덕션 빌드
```bash
npm run build
```

### 배포 옵션
- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **Docker**: `docker build -t miki-editor .`

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### 개발 규칙
- ESLint 규칙 준수
- 테스트 커버리지 유지
- 커밋 메시지 컨벤션 따르기
- 코드 리뷰 필수

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- [Toast UI Editor](https://ui.toast.com/tui-editor) - 마크다운 에디터
- [Zustand](https://github.com/pmndrs/zustand) - 상태 관리
- [TanStack Query](https://tanstack.com/query) - 데이터 페칭
- [Dexie](https://dexie.org/) - IndexedDB 래퍼

---

**Miki Editor v7** - 현대적이고 안정적인 마크다운 위키 에디터 🚀
