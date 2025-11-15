/**
 * Meki 코딩 컨벤션
 * 
 * 모든 코드는 이 규칙을 따라야 합니다.
 * AI 에이전트도 이 파일을 읽고 규칙을 준수합니다.
 */

export const CONVENTIONS = {
  // 파일 명명 규칙
  naming: {
    components: {
      format: 'PascalCase.jsx',
      examples: ['Editor.jsx', 'WikiLink.jsx', 'PublishButton.jsx'],
      badExamples: ['editor.jsx', 'wiki-link.jsx', 'publishbutton.jsx']
    },
    hooks: {
      format: 'useCamelCase.js',
      examples: ['useAutoSave.js', 'useWikiLinks.js'],
      badExamples: ['AutoSave.js', 'use-auto-save.js']
    },
    utils: {
      format: 'camelCase.js',
      examples: ['parseLinks.js', 'formatDate.js'],
      badExamples: ['ParseLinks.js', 'format-date.js']
    },
    services: {
      format: 'camelCaseService.js',
      examples: ['githubService.js', 'aiService.js'],
      badExamples: ['GithubService.js', 'github-service.js']
    }
  },

  // 컴포넌트 작성 스타일
  component: {
    type: 'function',
    description: '항상 function 키워드 사용 (화살표 함수 금지)',
    export: 'named',
    exportDescription: 'export function Component {...} (default export 금지)',
    props: 'destructured',
    propsDescription: 'function Component({ prop1, prop2 }) {...}',
    
    goodExample: `
// ✅ GOOD
export function Editor({ content, onChange }) {
  // ...
}`,
    
    badExample: `
// ❌ BAD
const Editor = (props) => { ... }  // 화살표 함수 X
export default Editor;              // default export X
function Editor(props) {            // 구조분해 안 함 X
  const content = props.content;
}
`
  },

  // TypeScript 사용 (선택적이지만 권장)
  typescript: {
    interface: '컴포넌트 Props는 interface로 정의',
    example: `
interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  autoSave?: boolean;
}

export function Editor({ content, onChange, autoSave = true }: EditorProps) {
  // ...
}`
  },

  // 폴더 구조
  structure: {
    'src/components/': {
      description: 'UI 컴포넌트만',
      examples: ['Editor.jsx', 'Sidebar.jsx']
    },
    'src/hooks/': {
      description: '커스텀 훅 (use- prefix 필수)',
      examples: ['useAutoSave.js', 'useWikiLinks.js']
    },
    'src/services/': {
      description: 'API 호출 로직 (GitHub, AI 등)',
      examples: ['githubService.js', 'openaiService.js']
    },
    'src/utils/': {
      description: '순수 함수 (helper, parser)',
      examples: ['parseWikiLinks.js', 'formatDate.js']
    },
    'src/types/': {
      description: 'TypeScript 타입 정의',
      examples: ['page.d.ts', 'editor.d.ts']
    }
  },

  // Git 커밋 메시지
  commits: {
    format: 'type: description',
    types: {
      feat: '새 기능 추가',
      fix: '버그 수정',
      docs: '문서 변경',
      refactor: '리팩토링 (기능 변경 없음)',
      style: '코드 포맷팅',
      test: '테스트 추가'
    },
    rules: [
      '현재형 동사 사용 (add, not added)',
      '첫 글자 소문자',
      '마침표 없음',
      '50자 이내'
    ],
    goodExamples: [
      'feat: add wiki link parser',
      'fix: editor auto-save timing',
      'refactor: simplify sidebar logic',
      'docs: update SDK README'
    ],
    badExamples: [
      'Added feature',              // 과거형 X
      'feat: Added wiki links.',    // 대문자 + 마침표 X
      'updated stuff',              // type 없음 X
      'Fix bug'                     // 첫 글자 대문자 X
    ]
  },

  // 스타일 가이드
  style: {
    indentation: '2 spaces',
    quotes: 'single',
    semicolons: true,
    trailingComma: 'es5'
  }
};

/**
 * 파일명 컨벤션 체크
 * @param {string} filePath - 체크할 파일 경로
 * @returns {boolean} - 통과 여부
 */
export function checkFileNaming(filePath) {
  const fileName = filePath.split('/').pop();
  const directory = filePath.split('/').slice(-2, -1)[0];

  // 컴포넌트 체크
  if (directory === 'components') {
    const isPascalCase = /^[A-Z][a-zA-Z0-9]*\.jsx$/.test(fileName);
    if (!isPascalCase) {
      console.warn(
        `⚠️  컴포넌트는 PascalCase.jsx 형식이어야 합니다\n` +
        `   현재: ${fileName}\n` +
        `   예시: ${CONVENTIONS.naming.components.examples.join(', ')}`
      );
      return false;
    }
  }

  // 훅 체크
  if (directory === 'hooks') {
    const hasUsePrefix = fileName.startsWith('use');
    if (!hasUsePrefix) {
      console.warn(
        `⚠️  커스텀 훅은 use- prefix가 필요합니다\n` +
        `   현재: ${fileName}\n` +
        `   예시: ${CONVENTIONS.naming.hooks.examples.join(', ')}`
      );
      return false;
    }
  }

  return true;
}

/**
 * 커밋 메시지 체크
 * @param {string} message - 체크할 커밋 메시지
 * @returns {boolean} - 통과 여부
 */
export function checkCommitMessage(message) {
  const format = /^(feat|fix|docs|refactor|style|test): [a-z].*[^.]$/; 
  
  if (!format.test(message)) {
    console.warn(
      `⚠️  커밋 메시지 형식이 올바르지 않습니다\n` +
      `   현재: ${message}\n` +
      `   형식: ${CONVENTIONS.commits.format}\n` +
      `   예시:\n${CONVENTIONS.commits.goodExamples.map(ex => `     ${ex}`).join('\n')}`
    );
    return false;
  }

  return true;
}
