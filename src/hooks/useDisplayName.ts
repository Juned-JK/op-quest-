import { useState, useCallback } from 'react';

const STORAGE_KEY = 'op_quest_names';

type NamesMap = Record<string, string>;

function loadNames(): NamesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NamesMap) : {};
  } catch {
    return {};
  }
}

function persistNames(map: NamesMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function useDisplayName(walletAddress: string | null) {
  const [names, setNames] = useState<NamesMap>(loadNames);

  const displayName = walletAddress ? (names[walletAddress] ?? '') : '';

  const saveDisplayName = useCallback(
    (name: string) => {
      if (!walletAddress) return;
      setNames((prev) => {
        const next = { ...prev, [walletAddress]: name.trim() };
        persistNames(next);
        return next;
      });
    },
    [walletAddress],
  );

  const clearDisplayName = useCallback(() => {
    if (!walletAddress) return;
    setNames((prev) => {
      const next = { ...prev };
      delete next[walletAddress];
      persistNames(next);
      return next;
    });
  }, [walletAddress]);

  // Look up any wallet's saved name — used by QuestCard to resolve createdBy
  const getDisplayNameFor = useCallback(
    (addr: string): string => names[addr] ?? '',
    [names],
  );

  return { displayName, saveDisplayName, clearDisplayName, getDisplayNameFor };
}
