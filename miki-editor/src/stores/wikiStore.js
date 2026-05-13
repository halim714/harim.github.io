import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '../utils/database';
import { buildEntityPage, listEntities } from '../wiki/tripleParser';

export const useWikiStore = create(
    subscribeWithSelector(
        immer((set, get) => ({
            triples: [],
            entityIndex: {},
            lastSyncedAt: null,

            loadTriples(triples) {
                set(state => {
                    state.triples = triples;
                    state.entityIndex = buildEntityIndex(triples);
                    state.lastSyncedAt = new Date().toISOString();
                });
            },

            async loadFromCache() {
                const cached = await db.graphCache.toArray();
                get().loadTriples(cached);
            },

            appendTriples(newTriples) {
                set(state => {
                    for (const t of newTriples) {
                        state.triples.push(t);
                        const key = normalize(t.subject);
                        if (!state.entityIndex[key]) state.entityIndex[key] = [];
                        state.entityIndex[key].push(t);
                    }
                });
            },

            getEntityPage(entityName) {
                return buildEntityPage(entityName, get().triples);
            },

            listEntities() {
                return listEntities(get().triples);
            },
        }))
    )
);

function normalize(str) {
    return String(str || '').toLowerCase().trim();
}

function buildEntityIndex(triples) {
    const index = {};
    for (const t of triples) {
        const key = normalize(t.subject);
        if (!index[key]) index[key] = [];
        index[key].push(t);
    }
    return index;
}
