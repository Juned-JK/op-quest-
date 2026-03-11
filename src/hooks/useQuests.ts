import { useState, useCallback, useEffect, useMemo } from 'react';
import { QuestType } from '../types/quest';
import type { Quest, QuestCompletion } from '../types/quest';
import { STAKING_QUEST_ADDRESS } from '../config/stakingContract';
import { VAULT_QUEST_ADDRESS } from '../config/vaultContract';

const STORAGE_KEY_COMPLETIONS = 'op_quest_completions';

// Fixed baseline timestamp so ids don't shift on every reload
const T = 1741000000000;

const DEFAULT_QUESTS: Quest[] = [
  // ── Normal — Social / Community ─────────────────────────────────────────
  {
    id: 'sys-follow-x',
    title: 'Follow OPNet on X',
    description: 'Follow the official OPNet account on X (Twitter) to stay updated on Bitcoin L1 smart contract news.',
    link: 'https://x.com/opnetbtc',
    questType: QuestType.Social,
    createdBy: 'system',
    createdAt: T,
  },
  {
    id: 'sys-retweet-x',
    title: 'Retweet a OPNet Post',
    description: 'Retweet the latest OPNet announcement on X and help grow the Bitcoin L1 smart contract community.',
    link: 'https://x.com/opnetbtc',
    questType: QuestType.Social,
    createdBy: 'system',
    createdAt: T + 60_000,
  },
  {
    id: 'sys-discord',
    title: 'Join OPNet Discord',
    description: 'Join the OPNet community Discord server and introduce yourself in the #general channel.',
    link: 'https://discord.gg/opnet',
    questType: QuestType.Discord,
    createdBy: 'system',
    createdAt: T + 120_000,
  },
  {
    id: 'sys-telegram',
    title: 'Join OPNet Telegram',
    description: 'Join the official OPNet Telegram channel for real-time announcements and community discussions.',
    link: 'https://t.me/opnetbtc',
    questType: QuestType.Telegram,
    createdBy: 'system',
    createdAt: T + 180_000,
  },
  {
    id: 'sys-github-star',
    title: 'Star OPNet on GitHub',
    description: 'Star the btc-vision GitHub organisation to support open-source Bitcoin L1 smart contract development.',
    link: 'https://github.com/btc-vision',
    questType: QuestType.Community,
    createdBy: 'system',
    createdAt: T + 240_000,
  },
  {
    id: 'sys-opwallet',
    title: 'Install OPWallet',
    description: 'Download and install OPWallet — the official Bitcoin L1 wallet for interacting with OPNet smart contracts.',
    link: 'https://opnet.org',
    questType: QuestType.Community,
    createdBy: 'system',
    createdAt: T + 300_000,
  },
  {
    id: 'sys-explorer',
    title: 'Explore OPNet Testnet',
    description: 'Visit the OPNet testnet explorer and browse live smart contracts deployed directly on Bitcoin L1.',
    link: 'https://testnet.opnet.org',
    questType: QuestType.Community,
    createdBy: 'system',
    createdAt: T + 360_000,
  },
  // ── DeFi — On-chain actions ─────────────────────────────────────────────
  {
    id: 'sys-testnet-tx',
    title: 'Send Your First Testnet Transaction',
    description: 'Send any transaction on OPNet testnet (Signet fork). Get free testnet BTC from a faucet and experience Bitcoin L1 DeFi firsthand.',
    link: 'https://testnet.opnet.org',
    questType: QuestType.TestnetTx,
    createdBy: 'system',
    createdAt: T + 420_000,
  },
  {
    id: 'sys-stake',
    title: 'Stake tBTC on OPNet',
    description: 'Stake testnet BTC through an OPNet smart contract. No bridges, no wrapping — pure Bitcoin L1 DeFi. Withdraw your stake anytime.',
    link: 'https://testnet.opnet.org',
    questType: QuestType.Staking,
    createdBy: 'system',
    createdAt: T + 480_000,
    minStakeAmount: '1000',
    stakingContractAddress: STAKING_QUEST_ADDRESS,
  },
  {
    id: 'sys-vault',
    title: 'Deposit into OPNet Vault',
    description: 'Make your first vault deposit on OPNet testnet. Fully verifiable on Bitcoin L1 — no custodians, no trust required. Withdraw anytime.',
    link: 'https://testnet.opnet.org',
    questType: QuestType.VaultDeposit,
    createdBy: 'system',
    createdAt: T + 540_000,
    minDepositAmount: '1000',
    vaultContractAddress: VAULT_QUEST_ADDRESS,
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export function useQuests() {
  // Start with default quests only — on-chain quests are loaded via setChainQuests.
  const [chainQuests, setChainQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);

  const [completions, setCompletions] = useState<QuestCompletion[]>(() =>
    loadFromStorage(STORAGE_KEY_COMPLETIONS, []),
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEY_COMPLETIONS, completions);
  }, [completions]);

  /**
   * Called by App after fetching quests from the smart contract.
   * Merges on-chain quests with default quests, deduplicating by id.
   */
  const setQuestsFromChain = useCallback((onChainQuests: Quest[]) => {
    setChainQuests(onChainQuests);
  }, []);

  // The full quest list = default hardcoded quests + on-chain quests (no duplicates).
  const quests: Quest[] = [
    ...DEFAULT_QUESTS,
    ...chainQuests.filter((cq) => !DEFAULT_QUESTS.some((dq) => dq.id === cq.id)),
  ];

  const completeQuest = useCallback(
    (questId: string, walletAddress: string, signature: string) => {
      const completion: QuestCompletion = {
        questId,
        walletAddress,
        signature,
        completedAt: Date.now(),
      };
      setCompletions((prev) => [...prev, completion]);
    },
    [],
  );

  // O(1) lookup: "questId:walletAddress" → completed
  const completionSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of completions) s.add(`${c.questId}:${c.walletAddress}`);
    return s;
  }, [completions]);

  // O(1) lookup: questId → count
  const completionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of completions) m.set(c.questId, (m.get(c.questId) ?? 0) + 1);
    return m;
  }, [completions]);

  const isCompleted = useCallback(
    (questId: string, walletAddress: string | null): boolean => {
      if (!walletAddress) return false;
      return completionSet.has(`${questId}:${walletAddress}`);
    },
    [completionSet],
  );

  const getCompletionCount = useCallback(
    (questId: string): number => completionCounts.get(questId) ?? 0,
    [completionCounts],
  );

  const getCompletionsForQuest = useCallback(
    (questId: string): QuestCompletion[] =>
      completions.filter((c) => c.questId === questId),
    [completions],
  );

  // Adds a fully-formed Quest object immediately after on-chain creation is confirmed,
  // so the creator sees their quest right away without waiting for the next fetch.
  const addQuestObject = useCallback((quest: Quest) => {
    setChainQuests((prev) => {
      if (prev.some((q) => q.id === quest.id)) return prev;
      return [quest, ...prev];
    });
  }, []);

  const updateQuestInState = useCallback((updated: Quest) => {
    setChainQuests((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q)),
    );
  }, []);

  const removeQuest = useCallback((questId: string) => {
    setChainQuests((prev) => prev.filter((q) => q.id !== questId));
    setCompletions((prev) => prev.filter((c) => c.questId !== questId));
  }, []);

  return {
    quests,
    loading,
    setLoading,
    setQuestsFromChain,
    addQuestObject,
    updateQuestInState,
    removeQuest,
    completeQuest,
    isCompleted,
    getCompletionCount,
    getCompletionsForQuest,
  };
}
