import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '../utils/database';
import { resolveInterventionContext } from '../services/interventionResolver';

export const useInterventionStore = create(
    subscribeWithSelector(
        immer((set, get) => ({
            interventions: [],

            load(interventions) {
                set(state => { state.interventions = interventions; });
            },

            async loadFromCache() {
                const cached = await db.interventionsCache.toArray();
                get().load(cached);
            },

            async append(newItem) {
                await db.interventionsCache.add(newItem);
                set(state => { state.interventions.push(newItem); });
                // GitHub append는 호출부(github 인스턴스 필요)에서 처리
                // interventionStore는 GitHub 서비스를 직접 의존하지 않음
            },

            buildContext(entities = [], concepts = []) {
                return resolveInterventionContext(get().interventions, { entities, concepts });
            },
        }))
    )
);
