import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { RawMemoCache } from '../utils/database';
import { confirmCuration } from '../services/curationPipeline';
import { useWikiStore } from './wikiStore';
import { useReflectionStore } from './reflectionStore';
import { useInterventionStore } from './interventionStore';
import { createByokClient } from '../services/byokClient';

/**
 * curationStore — 큐레이션 세션 상태 (Phone-first 스와이프)
 *
 * 3-state 결정 모델:
 *   - 결정 없음 (pending): decisions Map에 없음
 *   - 'selected': 오른쪽 스와이프 — 위키 추가
 *   - 'excluded': 왼쪽 스와이프 — 비공개
 *
 * pending 메모는 확정 시점에 그대로 남아 다음 세션에 다시 보임.
 */
export const useCurationStore = create(
    subscribeWithSelector(
        immer((set, get) => ({
            pending: [],
            decisions: new Map(),  // memoId → 'selected' | 'excluded'
            editingMemo: null,     // 현재 편집 중인 메모
            confirming: false,
            lastResult: null,

            async loadPending() {
                const items = await RawMemoCache.getPending();
                set(state => {
                    state.pending = items;
                    state.decisions = new Map();
                    state.editingMemo = null;
                });
            },

            markSelected(memoId) {
                set(state => { state.decisions.set(memoId, 'selected'); });
            },

            markExcluded(memoId) {
                set(state => { state.decisions.set(memoId, 'excluded'); });
            },

            undecide(memoId) {
                set(state => { state.decisions.delete(memoId); });
            },

            openEditor(memo) {
                set(state => { state.editingMemo = memo; });
            },

            closeEditor() {
                set(state => { state.editingMemo = null; });
            },

            async saveEdit(memoId, { title, body }) {
                await RawMemoCache.updateContent(memoId, { title, body });
                set(state => {
                    const idx = state.pending.findIndex(m => m.memoId === memoId);
                    if (idx >= 0) {
                        state.pending[idx].title = title;
                        state.pending[idx].body = body;
                    }
                });
            },

            /**
             * 큐레이션 확정 — selected 메모만 컴파일, excluded는 비공개 상태로 기록
             * pending(미결정) 메모는 다음 세션에 다시 보임
             */
            async confirm({ github, dataRepo = 'miki-data' }) {
                if (get().confirming) return;
                const byokClient = createByokClient();
                if (!byokClient) throw new Error('BYOK API 키가 설정되지 않았습니다.');

                set(state => { state.confirming = true; });
                try {
                    const { pending, decisions } = get();
                    const selectedMemos = pending
                        .filter(m => decisions.get(m.memoId) === 'selected')
                        .map(m => ({ id: m.memoId, title: m.title, body: m.body }));
                    const excludedMemos = pending
                        .filter(m => decisions.get(m.memoId) === 'excluded')
                        .map(m => ({ id: m.memoId }));

                    const result = await confirmCuration({
                        selectedMemos,
                        excludedMemos,
                        deps: {
                            byokClient,
                            github,
                            dataRepo,
                            wikiStore: useWikiStore.getState(),
                            reflectionStore: useReflectionStore.getState(),
                            interventionStore: useInterventionStore.getState(),
                        },
                    });

                    set(state => {
                        state.lastResult = result;
                        // 처리된 메모만 pending에서 제거. 미결정 메모는 유지.
                        state.pending = state.pending.filter(
                            m => !state.decisions.has(m.memoId)
                        );
                        state.decisions = new Map();
                    });

                    return result;
                } finally {
                    set(state => { state.confirming = false; });
                }
            },

            async refreshCount() {
                return await RawMemoCache.pendingCount();
            },
        }))
    )
);
