import { useState, useEffect, useCallback } from 'react';
import type { Quest } from '../types/quest';

/**
 * Fetches on-chain completion counts (for all quests) and per-wallet completion
 * status (when a wallet is connected) from the OPNet smart contract.
 *
 * Each quest may live on a different contract (legacy vs new). The
 * contractAddress field on each Quest determines which contract to query.
 * Quests without a contractAddress default to the original tracker contract.
 *
 * - Runs on mount and whenever quest IDs or the connected wallet changes.
 * - Clears stale per-wallet completion data when the wallet disconnects.
 * - `refresh(questId, contractAddr?)` re-fetches a single quest after a tx.
 */
export function useOnChainStatus(
  quests: Quest[],
  walletAddress: string | null,
  isCompletedOnChain: (questId: string, contractAddr?: string) => Promise<boolean | null>,
  getOnChainCount: (questId: string, contractAddr?: string) => Promise<number | null>,
  enabled: boolean,
) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Stable string so the effect only re-runs when quest IDs actually change.
  // contractAddress changes are captured too because the callback recreates
  // whenever questIds changes (new quest added always changes this string).
  const questIds = quests.map((q) => q.id).join(',');

  const fetchAll = useCallback(async () => {
    if (!enabled || !questIds) return;

    // Always fetch global completion counts (no wallet needed).
    // Each quest routes to its own contract via quest.contractAddress.
    const countResults = await Promise.all(
      quests.map(async (q) => [q.id, await getOnChainCount(q.id, q.contractAddress)] as const),
    );
    setCounts((prev) => {
      const next = { ...prev };
      for (const [id, count] of countResults) {
        if (count !== null) next[id] = count;
      }
      return next;
    });

    // Per-wallet completion status — only possible when a wallet is connected.
    if (!walletAddress) {
      // Wallet disconnected: clear stale data so a new wallet starts fresh.
      setCompleted({});
      return;
    }

    const completedResults = await Promise.all(
      quests.map(
        async (q) => [q.id, await isCompletedOnChain(q.id, q.contractAddress)] as const,
      ),
    );
    setCompleted((prev) => {
      const next = { ...prev };
      for (const [id, status] of completedResults) {
        if (status !== null) next[id] = status;
      }
      return next;
    });
  }, [questIds, walletAddress, isCompletedOnChain, getOnChainCount, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Re-fetches count and completion status for one quest.
   * Pass the quest's contractAddress so we query the right contract.
   * Call this after a successful on-chain transaction.
   */
  const refresh = useCallback(
    async (questId: string, contractAddr?: string) => {
      const [count, status] = await Promise.all([
        getOnChainCount(questId, contractAddr),
        walletAddress ? isCompletedOnChain(questId, contractAddr) : Promise.resolve(null),
      ]);
      if (count !== null) setCounts((prev) => ({ ...prev, [questId]: count }));
      if (status !== null) setCompleted((prev) => ({ ...prev, [questId]: status }));
    },
    [getOnChainCount, isCompletedOnChain, walletAddress],
  );

  return { onChainCompleted: completed, onChainCounts: counts, refresh };
}
