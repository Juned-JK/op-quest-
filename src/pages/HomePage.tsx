import { useState } from 'react';
import { CreatorGrid } from '../components/CreatorGrid';
import { CreateQuest } from '../components/CreateQuest';
import { QuestList } from '../components/QuestList';
import { isDefiQuestType } from '../types/quest';
import type { Quest, OnCompleteCallback } from '../types/quest';
import type { ReactionCounts, ReactionType } from '../hooks/useReactions';

type HomeTab = 'normal' | 'defi' | 'creators';

interface HomePageProps {
  quests: Quest[];
  isConnected: boolean;
  walletAddress: string | null;
  isAdmin: boolean;
  isCompleted: (questId: string, walletAddress: string | null) => boolean;
  getCompletionCount: (questId: string) => number;
  onChainCounts?: Record<string, number>;
  stakeBalances?: Record<string, bigint>;
  loading?: boolean;
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

export function HomePage({
  quests,
  isConnected,
  walletAddress,
  isAdmin,
  isCompleted,
  getCompletionCount,
  onChainCounts,
  stakeBalances,
  loading,
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
}: HomePageProps) {
  const [tab, setTab] = useState<HomeTab>('normal');

  const normalQuests = quests.filter((q) => !isDefiQuestType(q.questType));
  const defiQuests   = quests.filter((q) =>  isDefiQuestType(q.questType));

  const questListSharedProps = {
    walletAddress,
    isConnected,
    isAdmin,
    isCompleted,
    getCompletionCount,
    onChainCounts,
    stakeBalances,
    loading,
    getCompletedAt,
    inFlightQuests,
    reactionCounts,
    myReactions,
    onReact,
    onComplete,
    onWithdraw,
    onDelete,
    onEdit,
    onOwnerDelete,
    showTabs: false,
  };

  return (
    <main className="app-main">
      <div className="hero">
        <h1 className="hero-title">Complete Quests. Unlock DeFi on Bitcoin L1. <span className="hero-emoji">🚀</span></h1>
        <p className="hero-sub">
          Every quest is registered on OPNet Bitcoin L1 — no gas, no friction, fully on-chain.
        </p>

        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{quests.length}</span>
            <span className="hero-stat-label">Total Quests</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">{normalQuests.length}</span>
            <span className="hero-stat-label">Normal</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">{defiQuests.length}</span>
            <span className="hero-stat-label">DeFi</span>
          </div>
        </div>

      </div>

      <div className="home-layout">
        {/* ── Main quest browser ─────────────────────────────────── */}
        <section className="home-quests">

          {/* Top-level category tabs */}
          <div className="home-tabs">
            <button
              className={`home-tab home-tab--normal${tab === 'normal' ? ' home-tab--active' : ''}`}
              onClick={() => setTab('normal')}
            >
              <span className="home-tab-icon">🌐</span>
              <span className="home-tab-text">
                Normal Quests
                <span className="home-tab-count">{normalQuests.length}</span>
              </span>
              <span className="home-tab-sub">Follow, join Discord, social tasks</span>
            </button>

            <button
              className={`home-tab home-tab--defi${tab === 'defi' ? ' home-tab--active' : ''}`}
              onClick={() => setTab('defi')}
            >
              <span className="home-tab-icon">⛓️</span>
              <span className="home-tab-text">
                DeFi Quests
                <span className="home-tab-count home-tab-count--defi">{defiQuests.length}</span>
              </span>
              <span className="home-tab-sub">Stake, vault deposit, on-chain actions</span>
            </button>

            <button
              className={`home-tab home-tab--creators${tab === 'creators' ? ' home-tab--active' : ''}`}
              onClick={() => setTab('creators')}
            >
              <span className="home-tab-icon">👥</span>
              <span className="home-tab-text">By Creator</span>
              <span className="home-tab-sub">Browse by quest creator</span>
            </button>
          </div>

          {/* Tab content */}
          {tab === 'normal' && (
            <div className="home-quest-section">
              <div className="home-section-banner home-section-banner--normal">
                <span className="home-section-banner-icon">🌐</span>
                <div>
                  <strong>Normal Quests</strong>
                  <span>Social tasks: follow on X, join Discord, join Telegram, visit websites</span>
                </div>
              </div>
              <QuestList
                {...questListSharedProps}
                quests={normalQuests}
                sectionTitle=""
              />
            </div>
          )}

          {tab === 'defi' && (
            <div className="home-quest-section">
              <div className="home-section-banner home-section-banner--defi">
                <span className="home-section-banner-icon">⛓️</span>
                <div>
                  <strong>DeFi Quests</strong>
                  <span>On-chain actions verified by OPNet Bitcoin L1 smart contracts</span>
                </div>
              </div>
              <QuestList
                {...questListSharedProps}
                quests={defiQuests}
                sectionTitle=""
              />
            </div>
          )}

          {tab === 'creators' && (
            <CreatorGrid
              quests={quests}
              getDisplayNameFor={getDisplayNameFor}
              getAvatarFor={getAvatarFor}
            />
          )}
        </section>

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="sidebar">
          <CreateQuest isConnected={isConnected} />

          <div className="info-card">
            <h3 className="info-card-title">How it works</h3>
            <ol className="info-steps">
              <li>Connect your OPWallet above</li>
              <li>Pick a quest from Normal or DeFi</li>
              <li>Hit <strong>Complete</strong> and approve in your wallet</li>
              <li>Your completion is stored permanently on Bitcoin L1</li>
            </ol>
          </div>

          <div className="info-card">
            <h3 className="info-card-title">Quest Categories</h3>
            <ul className="create-info-list">
              <li><strong>🌐 Normal</strong> — Social tasks (follow, join, visit)</li>
              <li><strong>⛓️ DeFi</strong> — On-chain: stake tBTC, vault deposits, testnet txs</li>
              <li><strong>👥 By Creator</strong> — Browse quests grouped by their creator</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
