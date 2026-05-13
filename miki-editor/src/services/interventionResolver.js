/**
 * interventionResolver — interventions.jsonl → BYOK 시스템 프롬프트 RAG 빌더
 *
 * 역할:
 * - interventions.jsonl의 사용자 결정을 AI 호출 시 제약조건으로 주입
 * - 토큰 비용 통제: scope:'always' 항목 + 엔티티/개념 매칭 항목만 선택
 * - 1년 이상 미사용 항목은 dormant으로 분류 (주입 제외)
 *
 * intervention 포맷 (interventions.jsonl 한 라인):
 * {
 *   id: string,
 *   type: "accept" | "reject" | "modify" | "split" | "merge",
 *   scope: "always" | "entity:{name}" | "concept:{name}",
 *   subject: string,
 *   predicate: string,
 *   object: string,
 *   user_note: string,   // 사용자 설명
 *   created_at: string,
 *   last_used_at: string,
 * }
 */

const DORMANT_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000; // 1년

/**
 * 컴파일 컨텍스트에 맞는 intervention 목록 선택 (RAG)
 *
 * @param {Array} interventions - interventions.jsonl 전체 파싱 결과
 * @param {{ entities?: string[], concepts?: string[] }} context - 현재 처리 중인 메모의 엔티티/개념
 * @returns {Array} 주입할 intervention 배열
 */
export function selectRelevantInterventions(interventions, context = {}) {
    const now = Date.now();
    const { entities = [], concepts = [] } = context;

    return interventions.filter(item => {
        // 1년 이상 미사용 → dormant 제외
        const lastUsed = item.last_used_at ? new Date(item.last_used_at).getTime() : 0;
        if (now - lastUsed > DORMANT_THRESHOLD_MS && item.scope !== 'always') return false;

        // scope:'always' → 항상 포함
        if (item.scope === 'always') return true;

        // scope:'entity:{name}' → 현재 메모 엔티티에 매칭
        if (item.scope?.startsWith('entity:')) {
            const name = item.scope.slice('entity:'.length).toLowerCase();
            return entities.some(e => e.toLowerCase().includes(name));
        }

        // scope:'concept:{name}' → 현재 메모 개념에 매칭
        if (item.scope?.startsWith('concept:')) {
            const name = item.scope.slice('concept:'.length).toLowerCase();
            return concepts.some(c => c.toLowerCase().includes(name));
        }

        return false;
    });
}

/**
 * 선택된 intervention 배열 → 시스템 프롬프트 제약 문자열 생성
 *
 * @param {Array} selected - selectRelevantInterventions 결과
 * @returns {string} 시스템 프롬프트에 주입할 텍스트 (빈 배열이면 '')
 */
export function buildConstraintPrompt(selected) {
    if (!selected.length) return '';

    const lines = selected.map(item => {
        const base = `- [${item.type.toUpperCase()}] "${item.subject}" ${item.predicate} "${item.object}"`;
        return item.user_note ? `${base} → ${item.user_note}` : base;
    });

    return `다음 사용자 결정을 반드시 준수하세요 (이미 확정된 사항 — 재제안 금지):\n${lines.join('\n')}`;
}

/**
 * intervention 누적 로그 → 사용자 결정 패턴 통계 요약
 *
 * @param {Array} interventions
 * @returns {object|null}
 */
export function buildUserModelProfile(interventions = []) {
    if (!interventions.length) return null;

    const byType = interventions.reduce((acc, iv) => {
        acc[iv.type] = (acc[iv.type] || 0) + 1;
        return acc;
    }, {});

    const byScope = interventions.reduce((acc, iv) => {
        const prefix = (iv.scope || 'always').split(':')[0];
        acc[prefix] = (acc[prefix] || 0) + 1;
        return acc;
    }, {});

    const rejections = interventions
        .filter(iv => iv.type === 'reject')
        .reduce((acc, iv) => {
            const key = iv.subject || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    const topRejections = Object.entries(rejections)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([subject, count]) => ({ subject, count }));

    const approvals = interventions
        .filter(iv => iv.type === 'accept' || iv.type === 'edit')
        .reduce((acc, iv) => {
            const key = iv.subject || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    const topApprovals = Object.entries(approvals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([subject, count]) => ({ subject, count }));

    return {
        total: interventions.length,
        byType,
        byScope,
        topRejections,
        topApprovals,
    };
}

/**
 * 사용자 결정 패턴 요약 → 시스템 프롬프트 컨텍스트
 *
 * @param {object|null} profile
 * @returns {string}
 */
export function buildProfilePrompt(profile) {
    if (!profile) return '';
    const lines = ['[사용자 결정 패턴 요약 — 컴파일 참고]'];
    lines.push(`- 총 결정: ${profile.total}건`);
    if (profile.topRejections.length) {
        lines.push(`- 자주 거절한 주제: ${profile.topRejections.map(r => `${r.subject}(${r.count})`).join(', ')}`);
    }
    if (profile.topApprovals.length) {
        lines.push(`- 자주 승인한 주제: ${profile.topApprovals.map(r => `${r.subject}(${r.count})`).join(', ')}`);
    }
    return lines.join('\n');
}

/**
 * interventions 배열 + 메모 컨텍스트 → 주입용 시스템 프롬프트 컨텍스트
 * (wikiCompiler.js, reflectionEngine.js에서 직접 호출)
 *
 * @param {Array} interventions
 * @param {{ entities?: string[], concepts?: string[] }} context
 * @returns {object}
 */
export function resolveInterventionContext(interventions, context = {}) {
    const relevant = selectRelevantInterventions(interventions, context);
    const constraintPrompt = buildConstraintPrompt(relevant);
    const userProfile = buildUserModelProfile(interventions);
    const profilePrompt = buildProfilePrompt(userProfile);
    const fullSystemPrompt = [constraintPrompt, profilePrompt].filter(Boolean).join('\n\n');
    const resolved = {
        relevant,
        constraintPrompt,
        userProfile,
        profilePrompt,
        fullSystemPrompt,
    };

    Object.defineProperty(resolved, 'toString', {
        value: () => fullSystemPrompt,
        enumerable: false,
    });

    return resolved;
}

/**
 * intervention 항목 생성 헬퍼 (append 전 호출)
 *
 * @param {{ type, scope, subject, predicate, object, user_note? }} params
 * @returns {object} interventions.jsonl에 append할 항목
 */
export function createIntervention({ type, scope = 'always', subject, predicate, object, user_note = '' }) {
    const now = new Date().toISOString();
    return {
        id: `iv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        scope,
        subject,
        predicate,
        object,
        user_note,
        created_at: now,
        last_used_at: now,
    };
}
