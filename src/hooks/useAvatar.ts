import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'op_quest_avatars';

type AvatarMap = Record<string, string>;

function loadAvatars(): AvatarMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AvatarMap) : {};
  } catch {
    return {};
  }
}

function persistAvatars(map: AvatarMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

async function upsertAvatarDb(walletAddress: string, avatarData: string | null): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('user_profiles')
    .upsert({ wallet_address: walletAddress, avatar_data: avatarData, updated_at: new Date().toISOString() });
}

async function fetchAvatarsDb(addresses: string[]): Promise<AvatarMap> {
  if (!supabase || addresses.length === 0) return {};
  const { data } = await supabase
    .from('user_profiles')
    .select('wallet_address, avatar_data')
    .in('wallet_address', addresses)
    .not('avatar_data', 'is', null);
  if (!data) return {};
  const result: AvatarMap = {};
  for (const row of data as { wallet_address: string; avatar_data: string | null }[]) {
    if (row.avatar_data) result[row.wallet_address] = row.avatar_data;
  }
  return result;
}

export function useAvatar(walletAddress: string | null) {
  const [avatars, setAvatars] = useState<AvatarMap>(loadAvatars);

  const avatar = walletAddress ? (avatars[walletAddress] ?? '') : '';

  // On wallet connect: pull own avatar from Supabase if not already cached
  useEffect(() => {
    if (!walletAddress || avatars[walletAddress]) return;
    fetchAvatarsDb([walletAddress]).then((result) => {
      if (!result[walletAddress]) return;
      setAvatars((prev) => {
        const next = { ...prev, [walletAddress]: result[walletAddress] };
        persistAvatars(next);
        return next;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const saveAvatar = useCallback(
    (dataUrl: string) => {
      if (!walletAddress) return;
      setAvatars((prev) => {
        const next = { ...prev, [walletAddress]: dataUrl };
        persistAvatars(next);
        return next;
      });
      void upsertAvatarDb(walletAddress, dataUrl);
    },
    [walletAddress],
  );

  const clearAvatar = useCallback(() => {
    if (!walletAddress) return;
    setAvatars((prev) => {
      const next = { ...prev };
      delete next[walletAddress];
      persistAvatars(next);
      return next;
    });
    void upsertAvatarDb(walletAddress, null);
  }, [walletAddress]);

  const getAvatarFor = useCallback(
    (addr: string): string => avatars[addr] ?? '',
    [avatars],
  );

  // Batch-fetch avatars for a list of addresses not yet in the local cache.
  // Called by App.tsx whenever the quest list changes so creator avatars are visible.
  const prefetchAvatars = useCallback(
    async (addresses: string[]): Promise<void> => {
      const missing = addresses.filter((a) => a && a !== 'system' && !avatars[a]);
      if (missing.length === 0) return;
      const result = await fetchAvatarsDb(missing);
      if (Object.keys(result).length === 0) return;
      setAvatars((prev) => {
        const next = { ...prev, ...result };
        persistAvatars(next);
        return next;
      });
    },
    [avatars],
  );

  return { avatar, saveAvatar, clearAvatar, getAvatarFor, prefetchAvatars };
}
