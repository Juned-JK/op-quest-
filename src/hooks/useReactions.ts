/**
 * useReactions — per-quest 🔥 and 👍 reactions.
 *
 * Storage strategy:
 *  - My reactions  → localStorage (fast, wallet-scoped)
 *  - Global counts → Supabase `quest_reactions` table (shared across users)
 *                    Falls back to localStorage cache when Supabase is absent.
 *
 * Required Supabase table:
 *   CREATE TABLE quest_reactions (
 *     quest_id       TEXT    NOT NULL,
 *     wallet_address TEXT    NOT NULL,
 *     reaction_type  TEXT    NOT NULL,   -- 'fire' | 'like'
 *     created_at     BIGINT  NOT NULL,
 *     PRIMARY KEY (quest_id, wallet_address, reaction_type)
 *   );
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type ReactionType = 'fire' | 'like';

export interface ReactionCounts { fire: number; like: number; }

type MyReactionMap    = Record<string, { fire: boolean; like: boolean }>;
type ReactionCountMap = Record<string, ReactionCounts>;

const MY_KEY     = 'op_quest_my_reactions';
const COUNTS_KEY = 'op_quest_reaction_counts';

function load<T>(key: string, fb: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fb; }
  catch { return fb; }
}
function save<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export function useReactions(walletAddress: string | null) {
  const [myReactions, setMyReactions] = useState<MyReactionMap>(() => load(MY_KEY, {}));
  const [counts, setCounts]           = useState<ReactionCountMap>(() => load(COUNTS_KEY, {}));

  // Persist to localStorage whenever state changes
  useEffect(() => { save(MY_KEY,     myReactions); }, [myReactions]);
  useEffect(() => { save(COUNTS_KEY, counts);      }, [counts]);

  // Fetch global counts from Supabase on mount
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('quest_reactions')
      .select('quest_id, reaction_type')
      .then(({ data, error }) => {
        if (error || !data) return;
        const agg: ReactionCountMap = {};
        for (const row of data as { quest_id: string; reaction_type: string }[]) {
          if (!agg[row.quest_id]) agg[row.quest_id] = { fire: 0, like: 0 };
          if (row.reaction_type === 'fire') agg[row.quest_id].fire++;
          if (row.reaction_type === 'like') agg[row.quest_id].like++;
        }
        setCounts(agg);
      });
  }, []);

  const toggleReaction = useCallback(async (questId: string, type: ReactionType) => {
    if (!walletAddress) return;

    const current  = myReactions[questId] ?? { fire: false, like: false };
    const isActive = current[type];

    // Optimistic UI update
    setMyReactions(prev => ({
      ...prev,
      [questId]: { ...current, [type]: !isActive },
    }));
    setCounts(prev => {
      const c = prev[questId] ?? { fire: 0, like: 0 };
      return { ...prev, [questId]: { ...c, [type]: Math.max(0, c[type] + (isActive ? -1 : 1)) } };
    });

    if (!supabase) return;

    if (isActive) {
      await supabase
        .from('quest_reactions')
        .delete()
        .eq('quest_id', questId)
        .eq('wallet_address', walletAddress)
        .eq('reaction_type', type);
    } else {
      await supabase
        .from('quest_reactions')
        .upsert(
          { quest_id: questId, wallet_address: walletAddress, reaction_type: type, created_at: Date.now() },
          { onConflict: 'quest_id,wallet_address,reaction_type' },
        );
    }
  }, [walletAddress, myReactions]);

  return { reactionCounts: counts, myReactions, toggleReaction };
}
