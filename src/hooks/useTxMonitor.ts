import { useCallback, useEffect, useState } from 'react';

export interface TrackedTx {
  questId: string;
  questTitle: string;
  txId: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  startedAt: number;
  progressMsg: string;
}

export function useTxMonitor() {
  const [txs, setTxs] = useState<TrackedTx[]>([]);

  const addTx = useCallback((questId: string, questTitle: string) => {
    setTxs((prev) => {
      const entry: TrackedTx = {
        questId,
        questTitle,
        txId: null,
        status: 'pending',
        startedAt: Date.now(),
        progressMsg: 'Starting…',
      };
      // Reset if already tracked (user retrying)
      if (prev.some((t) => t.questId === questId)) {
        return prev.map((t) => (t.questId === questId ? entry : t));
      }
      return [...prev, entry];
    });
  }, []);

  const updateTx = useCallback(
    (questId: string, update: Partial<Pick<TrackedTx, 'txId' | 'status' | 'progressMsg'>>) => {
      setTxs((prev) =>
        prev.map((t) => (t.questId === questId ? { ...t, ...update } : t)),
      );
    },
    [],
  );

  const removeTx = useCallback((questId: string) => {
    setTxs((prev) => prev.filter((t) => t.questId !== questId));
  }, []);

  // Auto-dismiss confirmed/failed after 90 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTxs((prev) =>
        prev.filter((t) => t.status === 'pending' || now - t.startedAt < 90_000),
      );
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  return { txs, addTx, updateTx, removeTx };
}
