/**
 * wikiCompiler — 메모 → graph.jsonl 트리플 컴파일러
 *
 * ⚠️ Phase 10.5 이후 호출 규칙:
 *   이 모듈의 compileMemo()/compileAndAppend()는 **curationPipeline.confirmCuration()을 통해서만**
 *   호출되어야 한다. 메모 저장이나 자동 트리거에서 직접 호출 금지.
 *
 *   이유: graph.jsonl 갱신은 사용자의 큐레이션 세션을 통한 명시적 결정이어야 함.
 *   자동 호출은 사용자의 프라이버시 통제권을 박탈한다 (어떤 메모를 위키화할지 결정할 권한).
 *
 * 역할:
 * - 단일 메모를 받아 BYOK API로 트리플을 추출 (compileMemo)
 * - 추출 결과를 graph.jsonl에 append하고 메타데이터 반환 (compileAndAppend)
 * - 과거 트리플과의 연결 감지는 reflectionEngine이 담당
 *
 * 출력 트리플 포맷 (graph.jsonl 한 라인):
 * {
 *   id: string,            // "{subjectSlug}:{predicate}:{objectSlug}" (결정론적)
 *   subject: string,       // 엔티티 이름
 *   predicate: string,     // 관계 유형 (예: "trusts", "believes", "mentions")
 *   object: string,        // 대상 엔티티 또는 값
 *   entity_type: string,   // "person" | "relationship" | "stance"
 *   evidence_tier: string, // "Grounded" | "Bridged" | "Speculative"
 *   source_memo_id: string,
 *   created_at: string,    // ISO 8601
 * }
 */

import { ByokClient, ByokApiError } from './byokClient';

const EXTRACT_SYSTEM_PROMPT = `당신은 개인 메모에서 지식 그래프 트리플을 추출하는 AI입니다.
사용자의 메모를 읽고, 사람·관계·태도를 나타내는 트리플을 JSON 배열로 반환하세요.

출력 형식 (JSON 배열만 — 다른 텍스트 없음):
[
  {
    "subject": "엔티티 이름",
    "predicate": "관계 동사 (신뢰한다 | 믿는다 | 언급한다 | 좋아한다 | 반대한다 | ...)",
    "object": "대상 엔티티 또는 개념",
    "entity_type": "person | relationship | stance",
    "evidence_tier": "Grounded | Bridged | Speculative"
  }
]

규칙:
- Grounded: 메모에 명시적으로 서술된 관계
- Bridged: 메모의 맥락에서 강하게 암시되는 관계
- Speculative: 약한 추론, 불확실한 관계
- 트리플이 없으면 빈 배열 [] 반환
- subject/object는 고유명사 또는 개념어로 정규화`;

/**
 * @param {object} memo - { id, title, content }
 * @param {ByokClient} byokClient
 * @param {string} [interventionContext] - interventionResolver에서 받은 시스템 제약
 * @returns {Promise<Array>} 추출된 트리플 배열
 */
export async function compileMemo(memo, byokClient, interventionContext = '') {
    const systemPrompt = interventionContext
        ? `${EXTRACT_SYSTEM_PROMPT}\n\n[사용자 제약사항]\n${interventionContext}`
        : EXTRACT_SYSTEM_PROMPT;

    const userMessage = `메모 ID: ${memo.id}\n제목: ${memo.title}\n\n${memo.content}`;

    let raw;
    try {
        raw = await byokClient.complete(systemPrompt, userMessage, { maxTokens: 1024, temperature: 0.2 });
    } catch (error) {
        if (error instanceof ByokApiError) throw error;
        throw error;
    }

    const triples = parseTripleResponse(raw);
    const now = new Date().toISOString();

    return triples.map(t => ({
        id: makeTripleId(t.subject, t.predicate, t.object),
        subject: t.subject,
        predicate: t.predicate,
        object: t.object,
        entity_type: t.entity_type || 'stance',
        evidence_tier: t.evidence_tier || 'Speculative',
        source_memo_id: memo.id,
        created_at: now,
    }));
}

/**
 * 메모 저장 시 즉시 컴파일 + graph.jsonl append
 *
 * 호출 시점: 사용자가 메모를 저장(또는 포커스를 벗어날 때)
 * 이후 reflectionEngine.buildReflectionQueue()로 과거 연결을 탐지.
 *
 * @param {object} memo
 * @param {ByokClient} byokClient
 * @param {GitHubService} github
 * @param {string} dataRepo
 * @param {string} [interventionContext]
 * @returns {Promise<{ triples: Array, appended: number }>}
 */
export async function compileAndAppend(memo, byokClient, github, dataRepo, interventionContext = '') {
    const triples = await compileMemo(memo, byokClient, interventionContext);
    if (triples.length > 0) {
        await github.appendJsonl(dataRepo, 'graph.jsonl', triples);
    }
    return { triples, appended: triples.length };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseTripleResponse(raw) {
    try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        return JSON.parse(jsonMatch[0]);
    } catch {
        return [];
    }
}

function slugify(str) {
    return String(str)
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w가-힣]/g, '')
        .slice(0, 40);
}

function makeTripleId(subject, predicate, object) {
    return `${slugify(subject)}:${slugify(predicate)}:${slugify(object)}`;
}
