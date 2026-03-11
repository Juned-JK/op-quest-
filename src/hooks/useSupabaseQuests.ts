import { supabase } from '../lib/supabase';
import type { Quest } from '../types/quest';

/** DB row shape — mirrors the `quests` table columns. */
interface QuestRow {
  id: string;
  title: string;
  description: string;
  link: string;
  quest_type: number;
  created_by: string;
  creator_name: string | null;
  created_at: number;
  tx_id: string | null;
  contract_address: string;
  expires_at: number | null;
}

function rowToQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    link: row.link,
    questType: row.quest_type,
    createdBy: row.created_by,
    creatorName: row.creator_name ?? undefined,
    createdAt: row.created_at,
    txId: row.tx_id ?? undefined,
    contractAddress: row.contract_address || undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

function questToRow(quest: Quest): QuestRow {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    link: quest.link,
    quest_type: quest.questType ?? 0,
    created_by: quest.createdBy,
    creator_name: quest.creatorName ?? null,
    created_at: quest.createdAt,
    tx_id: quest.txId ?? null,
    contract_address: quest.contractAddress ?? '',
    expires_at: quest.expiresAt ?? null,
  };
}

/**
 * Fetch all quests from Supabase.
 * Returns [] if Supabase is not configured or the query fails.
 */
export async function fetchQuestsFromDb(): Promise<Quest[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] fetchQuestsFromDb error:', error.message);
      return [];
    }
    return (data as QuestRow[]).map(rowToQuest);
  } catch (err) {
    console.warn('[Supabase] fetchQuestsFromDb threw:', err);
    return [];
  }
}

/**
 * Update an existing quest row in Supabase (full upsert by id).
 */
export async function updateQuestInDb(quest: Quest): Promise<void> {
  return saveQuestToDb(quest); // upsert covers both insert and update
}

/**
 * Hard-delete a quest row from Supabase.
 * Called after the on-chain soft-delete tx is confirmed.
 */
export async function deleteQuestFromDb(questId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('quests').delete().eq('id', questId);
    if (error) console.warn('[Supabase] deleteQuestFromDb error:', error.message);
  } catch (err) {
    console.warn('[Supabase] deleteQuestFromDb threw:', err);
  }
}

/**
 * Upsert a quest into Supabase.
 * Idempotent — safe to call multiple times for the same quest id.
 * Silently skips if Supabase is not configured.
 */
export async function saveQuestToDb(quest: Quest): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('quests')
      .upsert(questToRow(quest), { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase] saveQuestToDb error:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] saveQuestToDb threw:', err);
  }
}
