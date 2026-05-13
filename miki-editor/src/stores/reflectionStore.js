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

                // 수락/수정 시 intervention으로 기록
                if (decision === 'accepted' || decision === 'modified') {
                    const card = get().queue.find(q => q.id === id);
                    if (card) {
                        const intervention = createIntervention({
                            type: decision === 'accepted' ? 'accept' : 'modify',
                            scope: `entity:${card.proposed_update.subject}`,
                            subject: card.proposed_update.subject,
                            predicate: card.proposed_update.predicate,
                            object: card.proposed_update.object,
                            user_note: note,
                        });
                        await useInterventionStore.getState().append(intervention);
                    }
                }
            },
        }))
    )
);
