/**
 * curationPipeline — 큐레이션 확정 시 선택 메모 → 위키 컴파일 파이프라인
 *
 * Phase 10.5의 핵심.
 * 자동 컴파일 없음. 사용자가 명시적으로 호출해야만 graph.jsonl이 갱신됨.
 *
 * 흐름:
 *   confirmCuration(selectedIds, excludedIds, deps)
 *     ↓
 *   for each selected memo:
 *     compileMemo()                    → 트리플 추출
 *     github.appendJsonl('graph.jsonl') → 원격 추가
 *     wikiStore.appendTriples()         → 인메모리 인덱스 갱신
 *     detectConnections(newTriples, priorTriples) → 과거 연결 감지
 *   reflectionStore.pushCards(newCards) → reflection 큐에 추가
 *   RawMemoCache.markSelected/Excluded  → 큐레이션 상태 영속
 */

import { compileMemo } from './wikiCompiler';
import { detectConnections } from './reflectionEngine';
import { RawMemoCache } from '../utils/database';

/**
 * 큐레이션 확정 — 선택된 메모들을 일괄 컴파일하고 reflection 카드를 생성
 *
 * @param {Object} params
 * @param {Array} params.selectedMemos - 위키화할 메모 배열 ({id, title, body|content})
 * @param {Array} params.excludedMemos - 사용자가 제외한 메모 ({id})
 * @param {Object} params.deps - 의존성 주입
 * @param {ByokClient} params.deps.byokClient
 * @param {GitHubService} params.deps.github
 * @param {string} params.deps.dataRepo
 * @param {Object} params.deps.wikiStore - useWikiStore.getState()
 * @param {Object} params.deps.reflectionStore - useReflectionStore.getState()
 * @param {Object} params.deps.interventionStore - useInterventionStore.getState()
 * @returns {Promise<{ compiled: number, triples: number, reflections: number }>}
 */
export async function confirmCuration({ selectedMemos, excludedMemos, deps }) {
    const { byokClient, github, dataRepo, wikiStore, reflectionStore, interventionStore } = deps;

    if (!byokClient) throw new Error('BYOK 설정이 필요합니다. 설정 페이지에서 API 키를 등록하세요.');

    // 1. 제외 메모 영속 (위키에 영향 없음, 향후 재제안도 방지)
    for (const memo of excludedMemos) {
        await RawMemoCache.markExcluded(memo.id);
    }

    if (!selectedMemos.length) {
        return { compiled: 0, triples: 0, reflections: 0 };
    }

    // 2. 선택 메모를 일괄 컴파일
    const priorTriples = wikiStore.triples;
    const allNewTriples = [];
    const allNewCards = [];

    for (const memo of selectedMemos) {
        const memoForCompile = {
            id: memo.id,
            title: memo.title,
            content: memo.body || memo.content || '',
        };

        // intervention RAG (예측된 엔티티 기반 — 간단히 메모 텍스트로 매칭)
        const entityHints = extractEntityHints(memoForCompile);
        const interventionContext = interventionStore.buildContext(entityHints, []);

        // 트리플 추출
        let newTriples;
        try {
            newTriples = await compileMemo(memoForCompile, byokClient, interventionContext);
        } catch (err) {
            console.error(`[curationPipeline] ${memo.id} 컴파일 실패:`, err);
            continue; // 한 메모 실패가 전체 세션을 중단시키지 않음
        }

        if (!newTriples.length) {
            await RawMemoCache.markSelected(memo.id);
            continue;
        }

        // 원격 graph.jsonl append
        await github.appendJsonl(dataRepo, 'graph.jsonl', newTriples);

        // 인메모리 그래프 즉시 갱신 (UI 반영용)
        wikiStore.appendTriples(newTriples);

        // 과거 연결 감지 → reflection 카드
        const cards = detectConnections(newTriples, priorTriples);
        allNewTriples.push(...newTriples);
        allNewCards.push(...cards);

        await RawMemoCache.markSelected(memo.id);
    }

    // 3. reflection 카드 일괄 enqueue
    if (allNewCards.length) {
        await reflectionStore.pushCards(allNewCards);
    }

    return {
        compiled: selectedMemos.length,
        triples: allNewTriples.length,
        reflections: allNewCards.length,
    };
}

/**
 * 메모 텍스트에서 엔티티 후보 추출 (intervention RAG용 힌트)
 * 간단한 휴리스틱 — 대문자/한글 명사 토큰 추출.
 * 정교한 NER는 BYOK 추출 단계에서 수행됨.
 */
function extractEntityHints(memo) {
    const text = `${memo.title} ${memo.content}`;
    const tokens = text.match(/[A-Z][a-z]+|[가-힣]{2,}/g) || [];
    return [...new Set(tokens)].slice(0, 20);
}
