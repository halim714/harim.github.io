/**
 * reflectionEngine — 신규 메모의 트리플이 과거와 연결될 때 Reflection 카드 생성
 *
 * 시의성 원칙:
 * "지금 쓴 메모가 과거의 기록과 이어질 때" 즉시 Reflection을 만든다.
 * 스케줄링 없음 — 메모 저장 이벤트가 유일한 트리거.
 *
 * 흐름:
 * 1. wikiCompiler.compileAndAppend() → 신규 트리플 추출
 * 2. reflectionEngine.detectConnections() → 과거 Prior와 비교
 * 3. Extending 트리플만 → Reflection 카드 (queue.jsonl에 append)
 * 4. UI가 queue에서 오늘 항목을 꺼내 표시
 *
 * Reflection 카드 포맷 (reflections/queue.jsonl 한 라인):
 * {
 *   id: string,
 *   type: "relation" | "identity",
 *   status: "pending" | "shown" | "accepted" | "rejected" | "modified",
 *   evidence_tier: "Grounded" | "Bridged" | "Speculative",
 *   prior_relation: string | null,   // 연결된 과거 트리플 ID
 *   proposed_update: { subject, predicate, object },
 *   rationale: string,               // "왜 이걸 보여드리나요?" 푸터
 *   source_memo_id: string,
 *   triggered_at: string,            // 메모 저장 시각 (ISO 8601)
 * }
 */

/**
 * 신규 트리플 vs Prior 비교 → Consistent / Extending 분류
 * (Tension 감지는 Phase 11)
 *
 * @param {object} newTriple
 * @param {Array} priorTriples
 * @returns {'Consistent' | 'Extending'}
 */
export function classifyTriple(newTriple, priorTriples) {
    const subjectMatches = priorTriples.filter(
        t => normalize(t.subject) === normalize(newTriple.subject)
    );

    if (!subjectMatches.length) return 'Extending';

    const exactMatch = subjectMatches.find(
        t =>
            normalize(t.predicate) === normalize(newTriple.predicate) &&
            normalize(t.object) === normalize(newTriple.object)
    );
    if (exactMatch) return 'Consistent';

    return 'Extending';
}

/**
 * 신규 메모의 트리플 배열에서 과거와 연결되는 항목 탐지
 * → Reflection 카드 배열 반환 (즉시 queue.jsonl에 append 가능)
 *
 * @param {Array} newTriples - compileMemo() 결과 (방금 저장된 메모에서 추출)
 * @param {Array} priorTriples - graph.jsonl의 기존 트리플 전체
 * @returns {Array} Reflection 카드 배열
 */
export function detectConnections(newTriples, priorTriples) {
    const now = new Date().toISOString();
    const cards = [];

    for (const triple of newTriples) {
        if (classifyTriple(triple, priorTriples) === 'Consistent') continue;

        const priorMatch = findRelatedPrior(triple, priorTriples);

        cards.push({
            id: `rf-${triple.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            type: 'relation',
            status: 'pending',
            evidence_tier: triple.evidence_tier || 'Speculative',
            prior_relation: priorMatch?.id || null,
            proposed_update: {
                subject: triple.subject,
                predicate: triple.predicate,
                object: triple.object,
            },
            rationale: buildRationale(triple, priorMatch),
            source_memo_id: triple.source_memo_id,
            triggered_at: now,
        });
    }

    return cards;
}

/**
 * Identity Reflection 카드 생성
 * 두 엔티티가 동일 인물일 가능성을 감지했을 때 호출
 *
 * @param {string} entityA
 * @param {string} entityB
 * @param {string} sourceMemoId
 * @param {string} evidenceSnippet
 * @returns {object}
 */
export function buildIdentityReflection(entityA, entityB, sourceMemoId, evidenceSnippet = '') {
    return {
        id: `rf-identity-${slugify(entityA)}-${slugify(entityB)}-${Date.now()}`,
        type: 'identity',
        status: 'pending',
        evidence_tier: 'Bridged',
        prior_relation: null,
        proposed_update: {
            subject: entityA,
            predicate: 'might_be_same_as',
            object: entityB,
        },
        modeling_options: [
            { key: 'merge_full', label: `"${entityA}"와 "${entityB}"는 동일인 — 완전 병합` },
            { key: 'merge_with_register', label: `동일인이나 맥락별 구분 유지` },
            { key: 'split_full', label: `다른 인물 — 분리 유지` },
        ],
        rationale: `"${entityA}"와 "${entityB}"가 동일 인물일 수 있습니다. 어떻게 구분하시겠어요?`,
        evidence_snippet: evidenceSnippet.slice(0, 200),
        source_memo_id: sourceMemoId,
        triggered_at: new Date().toISOString(),
    };
}

/**
 * 오늘의 Reflection 슬롯 선택
 * queue 전체에서 pending 항목을 evidence_tier 우선순위로 정렬해 반환
 *
 * @param {Array} queue - reflectionsQueue 전체
 * @param {number} maxSlots - 표시할 최대 카드 수 (기본 5)
 * @returns {Array}
 */
export function selectPendingCards(queue, maxSlots = 5) {
    const tierOrder = { Grounded: 0, Bridged: 1, Speculative: 2 };
    return queue
        .filter(item => item.status === 'pending')
        .sort((a, b) => {
            const tierDiff = (tierOrder[a.evidence_tier] ?? 2) - (tierOrder[b.evidence_tier] ?? 2);
            if (tierDiff !== 0) return tierDiff;
            // 최신 트리거 먼저 (시의성)
            return new Date(b.triggered_at) - new Date(a.triggered_at);
        })
        .slice(0, maxSlots);
}

/**
 * pending Reflection queue를 일자별 드립 피드 슬롯으로 배정
 *
 * @param {Array} queue - reflectionsQueue 전체
 * @param {object} options
 * @param {Date|string} [options.startDate] - 스케줄 시작일
 * @returns {Array} 일자별 Reflection 슬롯
 */
export function scheduleDripFeed(queue, options = {}) {
    const pending = queue.filter(q => q.status === 'pending');
    if (!pending.length) return [];

    const total = pending.length;
    const periodDays = Math.max(14, Math.min(28, Math.ceil(total / 4)));
    const baseDaily = Math.max(3, Math.min(5, Math.ceil(total / periodDays)));
    const tierOrder = { Grounded: 0, Bridged: 1, Speculative: 2 };

    const sorted = [...pending].sort((a, b) => {
        const tierDiff = (tierOrder[a.evidence_tier] ?? 2) - (tierOrder[b.evidence_tier] ?? 2);
        if (tierDiff !== 0) return tierDiff;
        return new Date(b.triggered_at) - new Date(a.triggered_at);
    });

    const schedule = [];
    const startDate = options.startDate ? new Date(options.startDate) : new Date();
    let cursor = 0;

    for (let day = 0; day < periodDays && cursor < sorted.length; day++) {
        const dailyLimit = day < 7 ? Math.min(3, baseDaily) : baseDaily;
        const slot = sorted.slice(cursor, cursor + dailyLimit);
        const scheduledFor = new Date(startDate);
        scheduledFor.setDate(scheduledFor.getDate() + day);
        const date = scheduledFor.toISOString().slice(0, 10);

        schedule.push({
            date,
            cards: slot.map(c => ({ ...c, scheduled_for: date })),
        });
        cursor += dailyLimit;
    }

    return schedule;
}

/**
 * 스케줄에서 지정 날짜의 Reflection 카드만 반환
 *
 * @param {Array} schedule - scheduleDripFeed() 결과
 * @param {Date} [date] - 조회 날짜
 * @returns {Array}
 */
export function selectTodaysSlot(schedule, date) {
    const today = (date || new Date()).toISOString().slice(0, 10);
    const slot = schedule.find(s => s.date === today);
    return slot ? slot.cards : [];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalize(str) {
    return String(str || '').toLowerCase().trim();
}

function slugify(str) {
    return String(str).toLowerCase().replace(/\s+/g, '_').replace(/[^\w가-힣]/g, '').slice(0, 30);
}

function findRelatedPrior(triple, priorTriples) {
    return priorTriples.find(
        t =>
            normalize(t.subject) === normalize(triple.subject) &&
            normalize(t.predicate) === normalize(triple.predicate)
    ) || null;
}

function buildRationale(triple, priorMatch) {
    if (priorMatch) {
        return `이전에 "${triple.subject} ${priorMatch.predicate} ${priorMatch.object}"로 기록했습니다. 새 메모에서 변화가 감지됐어요.`;
    }
    const tierLabel = {
        Grounded: '명시적으로 언급된',
        Bridged: '맥락에서 암시된',
        Speculative: '추론된',
    }[triple.evidence_tier] || '감지된';
    return `메모에서 ${tierLabel} 관계입니다. 위키에 추가할까요?`;
}
