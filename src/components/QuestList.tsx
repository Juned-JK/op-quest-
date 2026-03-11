import { useState } from 'react';
import { QuestCard } from './QuestCard';
import { QuestType, isDefiQuestType } from '../types/quest';
import type { Quest, OnCompleteCallback } from '../types/quest';
import type { ReactionCounts, ReactionType } from '../hooks/useReactions';

type TabFilter = 'all' | 'normal' | 'defi';
type SortKey   = 'newest' | 'popular' | 'expiring' | 'highest-stake';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',        label: '🕐 Newest'   },
  { key: 'popular',       label: '🔥 Popular'  },
  { key: 'expiring',      label: '⏳ Expiring' },
  { key: 'highest-stake', label: '💰 Stake'    },
];

function applySort(
  quests: Quest[],
  sort: SortKey,
  onChainCounts: Record<string, number> | undefined,
  getCount: (id: string) => number,
): Quest[] {
  const arr = [...quests];
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => b.createdAt - a.createdAt);
    case 'popular':
      return arr.sort((a, b) => {
        const ca = onChainCounts?.[a.id] ?? getCount(a.id);
        const cb = onChainCounts?.[b.id] ?? getCount(b.id);
        return cb - ca;
      });
    case 'expiring':
      return arr.sort((a, b) => {
        if (!a.expiresAt && !b.expiresAt) return 0;
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return a.expiresAt - b.expiresAt;
      });
    case 'highest-stake':
      return arr.sort((a, b) => {
        const stake = (q: Quest) => {
          if (q.questType === QuestType.Staking)      return Number(q.minStakeAmount   ?? '0');
          if (q.questType === QuestType.VaultDeposit) return Number(q.minDepositAmount ?? '0');
          return -1;
        };
        return stake(b) - stake(a);
      });
    default:
      return arr;
  }
}

interface QuestListProps {
  quests: Quest[];
  walletAddress: string | null;
  isConnected: boolean;
  isAdmin: boolean;
  isCompleted: (questId: string, walletAddress: string | null) => boolean;
  getCompletionCount: (questId: string) => number;
  onChainCounts?: Record<string, number>;
  stakeBalances?: Record<string, bigint>;
  loading?: boolean;
  reactionCounts?: Record<string, ReactionCounts>;
  myReactions?: Record<string, { fire: boolean; like: boolean }>;
  onReact?: (questId: string, type: ReactionType) => void;
  getCompletedAt?: (questId: string) => number | undefined;
  inFlightQuests?: Record<string, string>;
  onComplete: OnCompleteCallback;
  onWithdraw?: (questId: string, onProgress: (msg: string) => void) => Promise<string | null>;
  onDelete: (questId: string) => void;
  onEdit: (updatedQuest: Quest, onProgress: (msg: string) => void) => Promise<void>;
  onOwnerDelete: (questId: string, onProgress: (msg: string) => void) => Promise<void>;
  showTabs?: boolean;
  sectionTitle?: string;
}

export function QuestList({
  quests,
  walletAddress,
  isConnected,
  isAdmin,
  isCompleted,
  getCompletionCount,
  onChainCounts,
  stakeBalances,
  loading = false,
  reactionCounts,
  myReactions,
  onReact,
  getCompletedAt,
  inFlightQuests,
  onComplete,
  onWithdraw,
  onDelete,
  onEdit,
  onOwnerDelete,
  showTabs = true,
  sectionTitle = 'Active Quests',
}: QuestListProps) {
  const [tab,  setTab]  = useState<TabFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  if (loading) {
    return (
      <div className="quest-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="quest-card-skeleton" />
        ))}
      </div>
    );
  }

  if (quests.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">📋</span>
        <p>No quests yet.{isAdmin ? ' Create the first one!' : ' Check back soon.'}</p>
      </div>
    );
  }

  const normalQuests = quests.filter((q) => !isDefiQuestType(q.questType));
  const defiQuests   = quests.filter((q) =>  isDefiQuestType(q.questType));
  const filtered     = !showTabs ? quests : tab === 'normal' ? normalQuests : tab === 'defi' ? defiQuests : quests;
  const visible      = applySort(filtered, sort, onChainCounts, getCompletionCount);

  const completed = visible.filter((q) =>  isCompleted(q.id, walletAddress));
  const pending   = visible.filter((q) => !isCompleted(q.id, walletAddress));

  const renderCard = (quest: Quest, completedStatus: boolean) => (
    <QuestCard
      key={quest.id}
      quest={quest}
      isConnected={isConnected}
      isAdmin={isAdmin}
      isOwner={walletAddress !== null && walletAddress === quest.createdBy}
      completed={completedStatus}
      completedAt={completedStatus ? getCompletedAt?.(quest.id) : undefined}
      completionCount={getCompletionCount(quest.id)}
      onChainCount={onChainCounts?.[quest.id]}
      stakeBalance={stakeBalances?.[quest.id]}
      inFlightStatus={inFlightQuests?.[quest.id]}
      reactionCounts={reactionCounts?.[quest.id]}
      myReaction={myReactions?.[quest.id]}
      onReact={onReact}
      onComplete={onComplete}
      onWithdraw={onWithdraw}
      onDelete={onDelete}
      onEdit={onEdit}
      onOwnerDelete={onOwnerDelete}
    />
  );

  return (
    <div className="quest-list">
      <div className="quest-list-header">
        <h2 className="section-title">{sectionTitle}</h2>
        <div className="quest-stats">
          <span className="stat">
            <span className="stat-value">{quests.length}</span> total
          </span>
          {isConnected && (
            <span className="stat stat-success">
              <span className="stat-value">{quests.filter((q) => isCompleted(q.id, walletAddress)).length}</span> completed
            </span>
          )}
        </div>
      </div>

      {/* Category tabs — hidden when parent handles filtering */}
      {showTabs && (
        <div className="quest-tabs">
          <button
            className={`quest-tab${tab === 'all' ? ' quest-tab--active' : ''}`}
            onClick={() => setTab('all')}
          >
            All <span className="quest-tab-count">{quests.length}</span>
          </button>
          <button
            className={`quest-tab${tab === 'normal' ? ' quest-tab--active' : ''}`}
            onClick={() => setTab('normal')}
          >
            🌐 Normal <span className="quest-tab-count">{normalQuests.length}</span>
          </button>
          <button
            className={`quest-tab quest-tab--defi${tab === 'defi' ? ' quest-tab--active' : ''}`}
            onClick={() => setTab('defi')}
          >
            ⛓️ DeFi <span className="quest-tab-count">{defiQuests.length}</span>
          </button>
        </div>
      )}

      {/* Sort controls */}
      <div className="sort-row">
        <span className="sort-label">Sort</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`sort-btn${sort === key ? ' sort-btn--active' : ''}`}
            onClick={() => setSort(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {!isConnected && (
        <div className="wallet-hint-banner">
          Connect your <strong>OPWallet</strong> to complete quests and record your progress on Bitcoin L1.
        </div>
      )}

      <div className="quest-grid">
        {pending.map((q) => renderCard(q, false))}

        {completed.length > 0 && (
          <>
            <div className="quest-divider"><span>Completed</span></div>
            {completed.map((q) => renderCard(q, true))}
          </>
        )}

        {visible.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <span className="empty-icon">{tab === 'defi' ? '⛓️' : '🌐'}</span>
            <p>No {tab === 'defi' ? 'DeFi' : 'Normal'} quests yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
