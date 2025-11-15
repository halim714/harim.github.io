/**
 * Meki 컴포넌트 명세서
 * 
 * 모든 컴포넌트는 여기에 명세를 먼저 작성한 후 구현합니다.
 * Props 타입, 의존성, 우선순위를 명확히 정의합니다.
 */

export const COMPONENTS = {
  // === 레이아웃 컴포넌트 ===
  Layout: {
    path: 'src/components/Layout.jsx',
    description: 'react-resizable-panels 기반 메인 레이아웃 (사이드바 + 에디터)',
    props: {},
    status: 'planned',
    priority: 'P0',
    dependencies: {
      packages: ['react-resizable-panels'],
      components: ['Sidebar', 'Editor'] // EditorArea 대신 Editor로 명시
    },
    estimatedTime: '2시간',
    notes: '좌측 사이드바(25-40%)와 우측 에디터 영역(60-75%)으로 구성'
  },

  // === 에디터 컴포넌트 ===
  Editor: {
    path: 'src/components/Editor.jsx',
    description: 'TipTap 기반 WYSIWYG 마크다운 에디터',
    props: {
      content: {
        type: 'string',
        required: true,
        description: '편집할 마크다운 텍스트',
        example: '# Hello\n\nThis is **bold** text.'
      },
      onChange: {
        type: '(htmlContent: string) => void', // TipTap은 HTML을 반환하므로 명시
        required: true,
        description: '내용 변경 시 호출되는 콜백 (HTML 형식)'
      },
      autoSave: {
        type: 'boolean',
        required: false,
        default: true,
        description: '3초 debounce 자동 저장 활성화'
      }
    },
    status: 'planned',
    priority: 'P0',
    dependencies: {
      packages: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],
      components: ['EditorToolbar']
    },
    estimatedTime: '3시간',
    notes: 'StarterKit으로 Bold, Italic, Heading, List 등 기본 포맷 제공'
  },

  EditorToolbar: {
    path: 'src/components/EditorToolbar.jsx',
    description: '에디터 포맷팅 툴바 (Bold, Italic, Heading 등)',
    props: {
      editor: {
        type: 'Editor | null', // TipTap의 Editor 인스턴스 타입
        required: true,
        description: 'TipTap 에디터 인스턴스'
      }
    },
    status: 'planned',
    priority: 'P0',
    dependencies: {
      packages: ['lucide-react', '@/components/ui/button', '@/components/ui/separator'],
      components: []
    },
    estimatedTime: '2시간',
    notes: 'shadcn/ui Button 컴포넌트 사용, active 상태 시각적 표시'
  },

  // === 사이드바 컴포넌트 ===
  Sidebar: {
    path: 'src/components/Sidebar.jsx',
    description: '페이지 목록을 표시하고 선택할 수 있는 사이드바',
    props: {
      pages: {
        type: '{ id: string, title: string, updatedAt: Date }[]',
        required: true,
        description: '페이지 목록 배열'
      },
      onSelectPage: {
        type: '(pageId: string) => void',
        required: true,
        description: '페이지 선택 시 호출되는 콜백'
      },
      currentPageId: {
        type: 'string | null',
        required: false,
        description: '현재 선택된 페이지 ID (하이라이트용)'
      }
    },
    status: 'planned',
    priority: 'P0',
    dependencies: {
      packages: ['lucide-react', '@/components/ui/card', 'clsx'],
      components: []
    },
    estimatedTime: '2시간',
    notes: '최근 수정 순 정렬, 현재 페이지 하이라이트'
  },

  // === 위키 기능 컴포넌트 ===
  WikiLink: {
    path: 'src/components/WikiLink.jsx',
    description: '[[페이지]] 형식의 위키 링크 컴포넌트',
    props: {
      pageName: {
        type: 'string',
        required: true,
        description: '링크할 페이지 이름'
      },
      exists: {
        type: 'boolean',
        required: false,
        default: true,
        description: '페이지 존재 여부 (false면 빨간색 표시)'
      },
      onClick: {
        type: '(pageName: string) => void',
        required: true,
        description: '링크 클릭 시 호출'
      }
    },
    status: 'planned',
    priority: 'P1',
    dependencies: {
      packages: ['clsx'],
      components: []
    },
    estimatedTime: '1시간',
    notes: '존재하지 않는 페이지는 빨간색으로 표시 (Wikipedia 스타일)'
  },

  Backlinks: {
    path: 'src/components/Backlinks.jsx',
    description: '현재 페이지를 참조하는 다른 페이지 목록',
    props: {
      currentPageId: {
        type: 'string',
        required: true,
        description: '현재 페이지 ID'
      },
      backlinks: {
        type: '{ id: string, title: string, excerpt: string }[]',
        required: true,
        description: '백링크 목록 (발췌문 포함)'
      },
      onNavigate: {
        type: '(pageId: string) => void',
        required: true,
        description: '백링크 클릭 시 호출'
      }
    },
    status: 'planned',
    priority: 'P1',
    dependencies: {
      packages: ['@/components/ui/card'],
      components: ['WikiLink']
    },
    estimatedTime: '2시간',
    notes: '페이지 하단에 표시, 발췌문(50자)과 함께'
  },

  // === GitHub 연동 컴포넌트 ===
  PublishButton: {
    path: 'src/components/PublishButton.jsx',
    description: 'GitHub Pages로 발행하는 버튼',
    props: {
      pageId: {
        type: 'string',
        required: true,
        description: '발행할 페이지 ID'
      },
      onPublish: {
        type: '() => Promise<void>',
        required: true,
        description: '발행 처리 함수 (GitHub API 호출)'
      }
    },
    status: 'planned',
    priority: 'P0',
    dependencies: {
      packages: ['@/components/ui/button', 'lucide-react'],
      components: []
    },
    estimatedTime: '1시간',
    notes: '로딩 상태, 성공/실패 토스트 표시'
  }
};

/**
 * 컴포넌트 Props 검증
 * @param {string} componentName - 검증할 컴포넌트 이름
 * @param {object} props - 컴포넌트에 전달된 props
 * @returns {boolean} - 검증 통과 여부
 */
export function validateComponent(componentName, props) {
  const spec = COMPONENTS[componentName];
  
  if (!spec) {
    throw new Error(
      `❌ 컴포넌트 명세 없음: ${componentName}\n` +
      `사용 가능: ${Object.keys(COMPONENTS).join(', ')}`
    );
  }

  const errors = [];

  // 필수 props 체크
  for (const [propName, propSpec] of Object.entries(spec.props)) {
    if (propSpec.required && !(propName in props)) {
      errors.push(
        `필수 prop '${propName}' 누락\n` +
        `  타입: ${propSpec.type}\n` +
        `  설명: ${propSpec.description}`
      );
    }

    // 타입 체크 (기본) - 주: 이 방식은 array, null 등을 정확히 구분하지 못함. Zod 도입으로 개선 가능.
    if (propName in props) {
      const actualType = typeof props[propName];
      const expectedType = propSpec.type.split(/[<[]/)[0].trim(); // 'string', 'function', '{' 등 추출
      
      if (expectedType === '{' && actualType !== 'object') {
         errors.push(`'${propName}' 타입 불일치 (예상: object, 실제: ${actualType})`);
      } else if (expectedType !== '{' && !propSpec.type.includes(actualType) && actualType !== 'undefined') {
        errors.push(
          `'${propName}' 타입 불일치\n` +
          `  예상: ${propSpec.type}\n` +
          `  실제: ${actualType}`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error(`❌ ${componentName} 검증 실패:`);
    errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }

  console.log(`✅ ${componentName} 검증 통과`);
  return true;
}

/**
 * 의존성 체크 (패키지 + 컴포넌트)
 * @param {string} componentName - 체크할 컴포넌트 이름
 * @returns {boolean} - 의존성 충족 여부
 */
export function checkDependencies(componentName) {
  const spec = COMPONENTS[componentName];
  if (!spec) return false;

  const warnings = [];

  // 컴포넌트 의존성 체크
  for (const depComp of spec.dependencies.components) {
    const depSpec = COMPONENTS[depComp];
    if (!depSpec) {
      warnings.push(`⚠️  의존 컴포넌트 '${depComp}' 명세 없음`);
    } else if (depSpec.status === 'planned') {
      warnings.push(`⚠️  의존 컴포넌트 '${depComp}'가 아직 구현되지 않음 (Blocker)`);
    }
  }

  if (warnings.length > 0) {
    console.warn(`[${componentName}] 의존성 경고:`);
    warnings.forEach(w => console.warn(`  ${w}`));
    return false;
  }

  return true;
}

/**
 * 컴포넌트 상태 요약
 * @param {object} [filter] - { priority?: 'P0'|'P1'|'P2', status?: 'planned'|'in-progress'|'completed' }
 * @returns {object[]} - 필터링된 컴포넌트 목록
 */
export function getComponentStatus(filter = {}) {
  const { priority, status } = filter;
  
  return Object.entries(COMPONENTS)
    .filter(([_, spec]) => {
      if (priority && spec.priority !== priority) return false;
      if (status && spec.status !== status) return false;
      return true;
    })
    .map(([name, spec]) => ({
      name,
      status: spec.status,
      priority: spec.priority,
      path: spec.path,
      estimatedTime: spec.estimatedTime
    }));
}
