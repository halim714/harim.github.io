import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '../utils/database';
import { selectPendingCards } from '../services/reflectionEngine';
import { useInterventionStore } from './interventionStore';
import { createIntervention } from '../services/interventionResolver';

export const useReflectionStore = create(
    subscribeWithSelector(
        immer((set, get) => ({
            queue: [],
            pendingCards: [],

            async loadQueue() {
                const queue = await db.reflectionsQueue.toArray();
                set(state => {
                    state.queue = queue;
                    state.pendingCards = selectPendingCards(queue);
                });
            },

            async pushCards(newCards) {
                if (!newCards.length) return;
                await db.reflectionsQueue.bulkAdd(newCards);
                set(state => {
                    state.queue.push(...newCards);
                    state.pendingCards = selectPendingCards(state.queue);
                });
            },

            async resolveCard(id, decision, note = '') {
                // 로컬 상태 업데이트
                set(state => {
                    const item = state.queue.find(q => q.id === id);
                    if (item) item.status = decision;
                    state.pendingCards = selectPendingCards(state.queue);
                });

                // IndexedDB 업데이트
                const record = await db.reflectionsQueue.where('reflectionId').equals(id).first();
                if (record) {
                    await db.reflectionsQueue.update(record.id, { status: decision });
                }

                // 수락/수정/거절 시 intervention으로 기록
                const TYPE_MAP = { accepted: 'accept', modified: 'modify', rejected: 'reject' };
                if (TYPE_MAP[decision]) {
                    const card = get().queue.find(q => q.id === id);
                    if (card) {
                        const intervention = createIntervention({
                            type: TYPE_MAP[decision],
                            scope: `entity:${card.proposed_update.subject}`,
                            subject: card.proposed_update.subject,
                            predicate: card.proposed_update.predicate,
                            object: card.proposed_update.object,
                            user_note: decision === 'rejected'
                                ? '재제안 영구 차단 (ref-12 §3.3)'
                                : note,
                        });
                        await useInterventionStore.getState().append(intervention);
                    }
                }
            },
        }))
    )
);
