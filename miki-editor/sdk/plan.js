/**
 * Meki 개발 계획 (18일 MVP 로드맵)
 * 
 * 11/15 (금) - 12/1 (일)
 * Week별 목표와 작업, Blocker 관리
 */

const week1Tasks = [
  {
    id: 'W1-1',
    title: 'react-resizable-panels로 레이아웃 교체',
    type: 'component',
    target: 'Layout',
    estimate: '2시간',
    status: 'pending',
    blockers: [],
    description: '좌측 사이드바 + 우측 에디터 영역, 드래그로 크기 조절'
  },
  {
    id: 'W1-2',
    title: 'TipTap 에디터 기본 통합',
    type: 'component',
    target: 'Editor',
    estimate: '3시간',
    status: 'pending',
    blockers: [],
    description: 'StarterKit으로 Bold, Italic, Heading, List 등 기본 포맷'
  },
  {
    id: 'W1-3',
    title: '에디터 툴바 구현 (shadcn Button)',
    type: 'component',
    target: 'EditorToolbar',
    estimate: '2시간',
    status: 'pending',
    blockers: ['W1-2'],
    description: 'Bold, Italic, Heading1/2, List 버튼, active 상태 표시'
  },
  {
    id: 'W1-4',
    title: '사이드바 페이지 목록 표시',
    type: 'component',
    target: 'Sidebar',
    estimate: '2시간',
    status: 'pending',
    blockers: [],
    description: '페이지 목록, 선택 하이라이트, 최근 수정 순 정렬'
  },
  {
    id: 'W1-5',
    title: '자동 저장 기능 (3초 debounce)',
    type: 'hook',
    target: 'useAutoSave',
    estimate: '1시간',
    status: 'pending',
    blockers: ['W1-2'],
    description: 'localStorage 임시 저장, "Saving..." 표시'
  }
];

const week2Tasks = [
  {
    id: 'W2-1',
    title: '[[페이지]] 링크 파싱 로직',
    type: 'util',
    target: 'parseWikiLinks',
    estimate: '2시간',
    status: 'pending',
    blockers: ['W1-2'],
    description: '정규표현식으로 [[...]] 추출, WikiLink 컴포넌트로 변환'
  },
  {
    id: 'W2-2',
    title: 'WikiLink 컴포넌트 구현',
    type: 'component',
    target: 'WikiLink',
    estimate: '1시간',
    status: 'pending',
    blockers: ['W2-1'],
    description: '클릭 가능 링크, 존재하지 않는 페이지는 빨간색'
  },
  {
    id: 'W2-3',
    title: '백링크 자동 추적 로직',
    type: 'util',
    target: 'trackBacklinks',
    estimate: '2시간',
    status: 'pending',
    blockers: ['W2-2'],
    description: '모든 페이지 스캔, 링크 관계 매핑'
  },
  {
    id: 'W2-4',
    title: 'Backlinks 컴포넌트 구현',
    type: 'component',
    target: 'Backlinks',
    estimate: '2시간',
    status: 'pending',
    blockers: ['W2-3'],
    description: '페이지 하단에 백링크 목록 표시'
  },
  {
    id: 'W2-5',
    title: 'AI 관련 페이지 제안 (기본)',
    type: 'service',
    target: 'aiService',
    estimate: '4시간',
    status: 'pending',
    blockers: ['W2-4'],
    description: 'OpenAI API로 현재 페이지와 관련된 다른 페이지 추천'
  }
];

const week3Tasks = [
  {
    id: 'W3-1',
    title: 'GitHub API 서비스 구현',
    type: 'service',
    target: 'githubService',
    estimate: '3시간',
    status: 'pending',
    blockers: [],
    description: 'Octokit으로 파일 읽기/쓰기/커밋'
  },
  {
    id: 'W3-2',
    title: 'Publish 버튼 구현',
    type: 'component',
    target: 'PublishButton',
    estimate: '2시간',
    status: 'pending',
    blockers: ['W3-1'],
    description: 'Jekyll 형식 변환, GitHub 커밋, 로딩/성공/실패 UI'
  },
  {
    id: 'W3-3',
    title: '페이지 삭제 기능',
    type: 'component',
    target: 'DeleteButton',
    estimate: '1시간',
    status: 'pending',
    blockers: ['W3-2'],
    description: '확인 다이얼로그, 로컬 + GitHub 모두 삭제'
  },
  {
    id: 'W3-4',
    title: '통합 테스트 + 버그 수정',
    type: 'qa',
    target: 'All',
    estimate: '6시간',
    status: 'pending',
    blockers: ['W3-3'],
    description: '전체 워크플로우 테스트, 에러 처리, UX 개선'
  }
];

export const ROADMAP = {
  week1: {
    dates: '11/15 - 11/21',
    goal: '기본 UI 완성 (Layout + Editor + Sidebar)',
    tasks: week1Tasks
  },
  week2: {
    dates: '11/22 - 11/28',
    goal: '위키 기능 (링크 + 백링크 + AI 제안)',
    tasks: week2Tasks
  },
  week3: {
    dates: '11/29 - 12/1',
    goal: 'GitHub 발행 + 최종 통합',
    tasks: week3Tasks
  }
};

/**
 * 다음 작업 가져오기 (Blocker 고려)
 * @returns {object[]} - 시작 가능한 다음 3개 작업 목록
 */
export function getNextTasks() {
  const allTasks = Object.values(ROADMAP).flatMap(week => week.tasks);
  
  const doneTaskIds = new Set(
    allTasks
      .filter(task => task.status === 'done')
      .map(task => task.id)
  );

  const pendingTasks = allTasks.filter(task => task.status === 'pending');

  const readyTasks = pendingTasks.filter(task => {
    if (!task.blockers || task.blockers.length === 0) return true;
    return task.blockers.every(blockerId => doneTaskIds.has(blockerId));
  });

  return readyTasks.slice(0, 3).map(task => ({
    ...task,
    week: Object.entries(ROADMAP).find(([_, week]) => 
      week.tasks.some(t => t.id === task.id)
    )?.[0]
  }));
}

/**
 * 특정 작업을 시작할 수 있는지 체크
 * @param {string} taskId - 확인할 작업 ID
 * @returns {boolean} - 시작 가능 여부
 */
export function canStartTask(taskId) {
  const allTasks = Object.values(ROADMAP).flatMap(week => week.tasks);
  const task = allTasks.find(t => t.id === taskId);
  
  if (!task) {
    console.error(`❌ 작업을 찾을 수 없습니다: ${taskId}`);
    return false;
  }

  if (task.status === 'done') {
    console.log(`✅ ${taskId}는 이미 완료되었습니다`);
    return false;
  }

  if (task.status === 'in-progress') {
    console.log(`🔄 ${taskId}는 진행 중입니다`);
    return true;
  }

  const doneTaskIds = new Set(
    allTasks.filter(t => t.status === 'done').map(t => t.id)
  );

  for (const blockerId of task.blockers || []) {
    if (!doneTaskIds.has(blockerId)) {
      const blocker = allTasks.find(t => t.id === blockerId);
      console.warn(
        `⚠️  ${taskId}를 시작하려면 먼저 ${blockerId}를 완료하세요\n` +
        `   Blocker: ${blocker?.title}`
      );
      return false;
    }
  }

  console.log(`✅ ${taskId}를 시작할 수 있습니다`);
  return true;
}

/**
 * 전체 진행률 계산
 * @returns {object} - 전체 진행률 정보
 */
export function getProgress() {
  const allTasks = Object.values(ROADMAP).flatMap(week => week.tasks);
  const completed = allTasks.filter(task => task.status === 'done').length;
  const inProgress = allTasks.filter(task => task.status === 'in-progress').length;
  const total = allTasks.length;
  
  return {
    completed,
    inProgress,
    pending: total - completed - inProgress,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * 주차별 진행률 계산
 * @returns {object[]} - 각 주차별 진행률 정보
 */
export function getWeeklyProgress() {
  return Object.entries(ROADMAP).map(([weekKey, week]) => {
    const tasks = week.tasks;
    const completed = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    
    return {
      week: weekKey,
      dates: week.dates,
      goal: week.goal,
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  });
}
