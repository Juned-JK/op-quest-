import { useParams, Link } from 'react-router-dom';
import { QuestList } from '../components/QuestList';
import { Avatar } from '../components/Avatar';
import { resolveCreatorName } from '../utils/creators';
import type { Quest, OnCompleteCallback } from '../types/quest';
import type { ReactionCounts, ReactionType } from '../hooks/useReactions';

interface CreatorPageProps {
  quests: Quest[];
  walletAddress: string | null;
  isConnected: boolean;
  isAdmin: boolean;
  isCompleted: (questId: string, walletAddress: string | null) => boolean;
  getCompletionCount: (questId: string) => number;
  onChainCounts?: Record<string, number>;
  stakeBalances?: Record<string, bigint>;
  getCompletedAt?: (questId: string) => number | undefined;
  inFlightQuests?: Record<string, string>;
  onComplete: OnCompleteCallback;
  onWithdraw?: (questId: string, onProgress: (msg: string) => void) => Promise<string | null>;
  onDelete: (questId: string) => void;
  onEdit: (updatedQuest: Quest, onProgress: (msg: string) => void) => Promise<void>;
  onOwnerDelete: (questId: string, onProgress: (msg: string) => void) => Promise<void>;
  getDisplayNameFor: (addr: string) => string;
  getAvatarFor: (addr: string) => string;
  reactionCounts?: Record<string, ReactionCounts>;
  myReactions?: Record<string, { fire: boolean; like: boolean }>;
  onReact?: (questId: string, type: ReactionType) => void;
}

export function CreatorPage({
  quests,
  walletAddress,
  isConnected,
  isAdmin,
  isCompleted,
  getCompletionCount,
  onChainCounts,
  stakeBalances,
  inFlightQuests,
  onComplete,
  onWithdraw,
  onDelete,
  onEdit,
  onOwnerDelete,
  getCompletedAt,
  getDisplayNameFor,
  getAvatarFor,
  reactionCounts,
  myReactions,
  onReact,
}: CreatorPageProps) {
  const { creatorId } = useParams<{ creatorId: string }>();

  if (!creatorId) return null;

  const creatorQuests = quests.filter((q) => q.createdBy === creatorId);
  const name          = resolveCreatorName(creatorId, getDisplayNameFor, creatorQuests[0]?.creatorName);
  const avatarUrl     = getAvatarFor(creatorId) || undefined;
  const total         = creatorQuests.length;

  return (
    <main className="app-main">
      <div className="creator-page-header">
        <Link to="/" className="back-link">
          ← All Creators
        </Link>

        <div className="creator-page-identity">
          <Avatar createdBy={creatorId} name={name} avatarUrl={avatarUrl} size="lg" />
          <div>
            <h1 className="creator-page-name">{name}</h1>
            <p className="creator-page-sub">
              {total} {total === 1 ? 'quest' : 'quests'}
            </p>
          </div>
        </div>
      </div>

      <QuestList
        quests={creatorQuests}
        walletAddress={walletAddress}
        isConnected={isConnected}
        isAdmin={isAdmin}
        isCompleted={isCompleted}
        getCompletionCount={getCompletionCount}
        onChainCounts={onChainCounts}
        stakeBalances={stakeBalances}
        getCompletedAt={getCompletedAt}
        inFlightQuests={inFlightQuests}
        reactionCounts={reactionCounts}
        myReactions={myReactions}
        onReact={onReact}
        onComplete={onComplete}
        onWithdraw={onWithdraw}
        onDelete={onDelete}
        onEdit={onEdit}
        onOwnerDelete={onOwnerDelete}
      />
    </main>
  );
}
