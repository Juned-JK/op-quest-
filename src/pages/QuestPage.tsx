import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { resolveCreatorName } from '../utils/creators';
import { QuestType, isDefiQuestType } from '../types/quest';
import { DEFAULT_MIN_STAKE_SATS } from '../config/stakingContract';
import { DEFAULT_MIN_DEPOSIT_SATS } from '../config/vaultContract';
import type { Quest, QuestCompletion, OnCompleteCallback } from '../types/quest';

// ── Helpers ────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatExpiry(ts: number): string {
  const diff  = ts - Date.now();
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (hours < 1)  return 'Expires in < 1h';
  if (hours < 24) return `Expires in ${hours}h`;
  if (days  < 7)  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  return `Expires ${new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatSats(sats: bigint): string {
  if (sats >= 100_000_000n) return `${(Number(sats) / 1e8).toFixed(4)} tBTC`;
  if (sats >= 1_000n)       return `${Number(sats).toLocaleString()} sats`;
  return `${sats} sats`;
}

const QUEST_TYPE_META: Record<number, { icon: string; label: string }> = {
  [QuestType.Social]:       { icon: '𝕏',  label: 'Social'        },
  [QuestType.Discord]:      { icon: '💬', label: 'Discord'       },
  [QuestType.Telegram]:     { icon: '✈️', label: 'Telegram'      },
  [QuestType.Community]:    { icon: '⚡', label: 'Community'     },
  [QuestType.Staking]:      { icon: '💰', label: 'Staking'       },
  [QuestType.VaultDeposit]: { icon: '🏦', label: 'Vault Deposit' },
  [QuestType.TestnetTx]:    { icon: '🔗', label: 'Testnet Tx'    },
};

function getQuestIcon(quest: Quest): string {
  if (quest.questType !== undefined) {
    return QUEST_TYPE_META[quest.questType]?.icon ?? '⚡';
  }
  const l = quest.link.toLowerCase();
  if (l.includes('x.com') || l.includes('twitter.com')) return '𝕏';
  if (l.includes('discord'))                              return '💬';
  if (l.includes('t.me') || l.includes('telegram'))      return '✈️';
  return '⚡';
}

// ── Props ──────────────────────────────────────────────────────────────────

interface QuestPageProps {
  quests: Quest[];
  walletAddress: string | null;
  isConnected: boolean;
  isAdmin: boolean;
  isCompleted: (questId: string, walletAddress: string | null) => boolean;
  getCompletionCount: (questId: string) => number;
  onChainCounts?: Record<string, number>;
  stakeBalances?: Record<string, bigint>;
  inFlightQuests?: Record<string, string>;
  onComplete: OnCompleteCallback;
  onWithdraw?: (questId: string, onProgress: (msg: string) => void) => Promise<string | null>;
  onDelete: (questId: string) => void;
  onEdit: (updatedQuest: Quest, onProgress: (msg: string) => void) => Promise<void>;
  onOwnerDelete: (questId: string, onProgress: (msg: string) => void) => Promise<void>;
  getDisplayNameFor: (addr: string) => string;
  getAvatarFor: (addr: string) => string;
  getCompletionsForQuest: (questId: string) => QuestCompletion[];
}

// ── Component ──────────────────────────────────────────────────────────────

export function QuestPage({
  quests,
  walletAddress,
  isConnected,
  isCompleted,
  getCompletionCount,
  onChainCounts,
  stakeBalances,
  inFlightQuests,
  onComplete,
  onWithdraw,
  getDisplayNameFor,
  getAvatarFor,
  getCompletionsForQuest,
}: QuestPageProps) {
  const { questId } = useParams<{ questId: string }>();

  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [txId,      setTxId]      = useState<string | null>(null);
  const [txCopied,  setTxCopied]  = useState(false);
  const [wdLoading, setWdLoading] = useState(false);
  const [wdStatus,  setWdStatus]  = useState('');
  const [wdError,   setWdError]   = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  if (!questId) return null;

  const quest = quests.find((q) => q.id === questId);

  if (!quest) {
    return (
      <main className="app-main">
        <div className="quest-detail-header">
          <Link to="/" className="back-link">← All Quests</Link>
        </div>
        <div className="empty-state" style={{ marginTop: '3rem' }}>
          <span className="empty-icon">🔍</span>
          <p>Quest not found. It may have been removed or the link is invalid.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '1.25rem', display: 'inline-flex' }}>
            ← Browse Quests
          </Link>
        </div>
      </main>
    );
  }

  const isStaking      = quest.questType === QuestType.Staking;
  const isVaultDeposit = quest.questType === QuestType.VaultDeposit;
  const isDefi         = isDefiQuestType(quest.questType);
  const completed      = isCompleted(questId, walletAddress);
  const localCount     = getCompletionCount(questId);
  const onChainCount   = (!isStaking && !isVaultDeposit) ? (onChainCounts?.[questId] ?? null) : null;
  const stakeBalance   = stakeBalances?.[questId];
  const completions    = getCompletionsForQuest(questId);
  const creatorName    = resolveCreatorName(quest.createdBy, getDisplayNameFor, quest.creatorName);
  const avatarUrl      = getAvatarFor(quest.createdBy) || undefined;
  const typeMeta       = quest.questType !== undefined ? QUEST_TYPE_META[quest.questType] : null;
  const minSats        = isStaking
    ? BigInt(quest.minStakeAmount  ?? String(DEFAULT_MIN_STAKE_SATS))
    : isVaultDeposit
    ? BigInt(quest.minDepositAmount ?? String(DEFAULT_MIN_DEPOSIT_SATS))
    : 0n;

  const hasActiveBalance = (isStaking || isVaultDeposit) && stakeBalance !== 0n;
  const hasWithdrawn     = (isStaking || isVaultDeposit) && completed && stakeBalance === 0n;
  const inFlightStatus   = inFlightQuests?.[questId] ?? null;

  const handleComplete = async () => {
    if (!isConnected || completed || loading) return;
    setError(null);
    setTxId(null);
    setLoading(true);
    setStatus(isStaking ? 'Preparing stake…' : isVaultDeposit ? 'Preparing deposit…' : 'Starting…');
    try {
      const id = await onComplete(quest.id, quest.title, setStatus);
      if (id) setTxId(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const handleWithdraw = async () => {
    if (!onWithdraw || wdLoading) return;
    setWdError(null);
    setTxId(null);
    setWdLoading(true);
    setWdStatus('Preparing withdrawal…');
    try {
      const id = await onWithdraw(quest.id, setWdStatus);
      if (id) setTxId(id);
    } catch (err: unknown) {
      setWdError(err instanceof Error ? err.message : 'Withdrawal failed.');
    } finally {
      setWdLoading(false);
      setWdStatus('');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  const handleCopyTx = () => {
    if (!txId) return;
    navigator.clipboard.writeText(txId).then(() => {
      setTxCopied(true);
      setTimeout(() => setTxCopied(false), 2000);
    });
  };

  const isInFlight  = !loading && !!inFlightStatus;
  const actionLabel = (loading || isInFlight)
    ? <><span className="spinner" /> {status || inFlightStatus || 'Sending…'}</>
    : isStaking      ? `Stake ${formatSats(minSats)}`
    : isVaultDeposit ? `Deposit ${formatSats(minSats)}`
    : 'Complete Quest';

  return (
    <main className="app-main">
      {/* ── Back nav ──────────────────────────────────────────── */}
      <div className="quest-detail-header">
        <Link to="/" className="back-link">← All Quests</Link>
        <button
          className={`btn btn-ghost btn-sm quest-share-btn${urlCopied ? ' quest-share-btn--copied' : ''}`}
          onClick={handleCopyUrl}
          title="Copy link to this quest"
        >
          {urlCopied ? '✓ Copied!' : '⧉ Share'}
        </button>
      </div>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className={`quest-detail-hero${isStaking ? ' quest-detail-hero--staking' : isDefi ? ' quest-detail-hero--defi' : ''}`}>
        <div className="quest-detail-icon">{getQuestIcon(quest)}</div>
        <div className="quest-detail-hero-body">
          <div className="quest-detail-title-row">
            <h1 className="quest-detail-title">{quest.title}</h1>
            <div className="quest-detail-badges">
              {typeMeta && (
                <span className={`badge ${isStaking ? 'badge-staking' : isDefi ? 'badge-defi' : 'badge-type'}`}>
                  {typeMeta.icon} {typeMeta.label}
                </span>
              )}
              {completed && <span className="badge badge-success">✓ Done</span>}
              {quest.expiresAt && (
                <span className={`badge badge-expiry${quest.expiresAt - Date.now() < 86_400_000 ? ' badge-expiry--urgent' : ''}`}>
                  ⏳ {formatExpiry(quest.expiresAt)}
                </span>
              )}
            </div>
          </div>

          <Link
            to={`/creator/${quest.createdBy}`}
            className="quest-detail-creator-link"
          >
            <Avatar
              createdBy={quest.createdBy}
              name={creatorName}
              avatarUrl={avatarUrl}
              size="sm"
            />
            <span className="quest-detail-creator-name">{creatorName}</span>
            <span className="quest-detail-meta-sep">·</span>
            <span className="quest-detail-meta-muted">
              {timeAgo(quest.createdAt)}
            </span>
          </Link>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="quest-detail-body">
        {/* Left column */}
        <div className="quest-detail-main">
          {quest.description && (
            <section className="quest-detail-section">
              <h2 className="quest-detail-section-title">About this Quest</h2>
              <p className="quest-detail-description">{quest.description}</p>
            </section>
          )}

          {(isStaking || isVaultDeposit) && (
            <section className="quest-detail-section">
              <h2 className="quest-detail-section-title">Requirements</h2>
              <div className={`staking-info${isVaultDeposit ? ' staking-info--vault' : ''}`}>
                <span className="staking-info-icon">{isVaultDeposit ? '🏦' : '🔒'}</span>
                <span className="staking-info-text">
                  {isVaultDeposit ? 'Deposit' : 'Stake'} at least{' '}
                  <strong>{formatSats(minSats)}</strong> tBTC on OPNet testnet to complete.
                  You can withdraw anytime.
                </span>
              </div>
            </section>
          )}

          {quest.link && quest.link !== '#' && (
            <section className="quest-detail-section">
              <h2 className="quest-detail-section-title">Link</h2>
              <a
                className="quest-detail-link"
                href={quest.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {quest.link} ↗
              </a>
            </section>
          )}

          {/* Recent completers */}
          <section className="quest-detail-section">
            <h2 className="quest-detail-section-title">
              Recent Completions
              <span className="quest-detail-section-count">{localCount}</span>
            </h2>
            {completions.length === 0 ? (
              <p className="quest-detail-empty">No completions recorded yet. Be the first!</p>
            ) : (
              <ul className="quest-detail-completers">
                {[...completions]
                  .sort((a, b) => b.completedAt - a.completedAt)
                  .slice(0, 20)
                  .map((c, i) => (
                    <li key={i} className="quest-detail-completer">
                      <Link
                        to={`/creator/${c.walletAddress}`}
                        className="quest-detail-completer-addr"
                        title={c.walletAddress}
                      >
                        {shortAddr(c.walletAddress)}
                      </Link>
                      <span className="quest-detail-completer-time">
                        {timeAgo(c.completedAt)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right sidebar */}
        <aside className="quest-detail-sidebar">
          {/* Action panel */}
          <div className={`quest-action-panel${isStaking ? ' quest-action-panel--staking' : isDefi ? ' quest-action-panel--defi' : ''}`}>
            <p className="quest-action-title">
              {completed
                ? isStaking ? '💰 Staked' : isVaultDeposit ? '🏦 Deposited' : '✓ Completed'
                : isStaking ? 'Stake tBTC' : isVaultDeposit ? 'Deposit tBTC' : 'Complete Quest'}
            </p>

            {completed && !hasWithdrawn && (
              <p className="quest-action-status-text quest-action-status-text--done">
                You have completed this quest.
              </p>
            )}
            {hasWithdrawn && (
              <p className="quest-action-status-text">
                {isVaultDeposit ? 'Deposit withdrawn ✓' : 'Stake withdrawn ✓'}
              </p>
            )}
            {!completed && isConnected && (
              <p className="quest-action-status-text">
                {isStaking
                  ? `Stake ${formatSats(minSats)} tBTC to complete.`
                  : isVaultDeposit
                  ? `Deposit ${formatSats(minSats)} tBTC to complete.`
                  : 'Sign with your wallet to record completion on Bitcoin L1.'}
              </p>
            )}
            {!isConnected && (
              <p className="quest-action-status-text">
                Connect your OPWallet to{' '}
                {isStaking ? 'stake' : isVaultDeposit ? 'deposit' : 'complete'}.
              </p>
            )}

            {/* Stake/deposit balance */}
            {(isStaking || isVaultDeposit) && stakeBalance != null && stakeBalance > 0n && (
              <div className={`stake-balance${isVaultDeposit ? ' stake-balance--vault' : ''}`}>
                {isVaultDeposit ? 'Deposited' : 'Staked'}:{' '}
                <strong>{formatSats(stakeBalance)}</strong>
              </div>
            )}

            {/* Complete button */}
            {!completed && (
              <button
                className={`btn btn-primary btn-full${isStaking || isVaultDeposit ? ' btn-stake' : ''}`}
                onClick={handleComplete}
                disabled={!isConnected || loading || isInFlight}
              >
                {actionLabel}
              </button>
            )}

            {/* Withdraw button */}
            {completed && (isStaking || isVaultDeposit) && hasActiveBalance && onWithdraw && (
              <button
                className="btn btn-full btn-withdraw"
                onClick={handleWithdraw}
                disabled={wdLoading}
              >
                {wdLoading
                  ? <><span className="spinner" /> {wdStatus || 'Withdrawing…'}</>
                  : isVaultDeposit ? 'Withdraw Deposit' : 'Withdraw Stake'}
              </button>
            )}

            {error   && <p className="quest-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
            {wdError && <p className="quest-error" style={{ marginTop: '0.5rem' }}>{wdError}</p>}

            {/* TX hash */}
            {txId && (
              <div className="tx-hash-row" style={{ marginTop: '0.75rem' }}>
                <span className="tx-hash-label">Tx</span>
                <span className="tx-hash-value">{txId.slice(0, 8)}…{txId.slice(-6)}</span>
                <button className="tx-copy-btn" onClick={handleCopyTx} title="Copy tx hash">
                  {txCopied ? '✓' : '⧉'}
                </button>
              </div>
            )}
          </div>

          {/* Stats panel */}
          <div className="quest-stats-card">
            <p className="quest-stats-card-title">Stats</p>
            <div className="quest-stats-card-row">
              <span className="quest-stats-card-label">Local completions</span>
              <strong className="quest-stats-card-value">{localCount}</strong>
            </div>
            {onChainCount != null && (
              <div className="quest-stats-card-row">
                <span className="quest-stats-card-label">On-chain verifications</span>
                <strong className="quest-stats-card-value">{onChainCount}</strong>
              </div>
            )}
            {quest.createdAt && (
              <div className="quest-stats-card-row">
                <span className="quest-stats-card-label">Created</span>
                <span className="quest-stats-card-value quest-stats-card-value--muted">
                  {new Date(quest.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            )}
            {quest.expiresAt && (
              <div className="quest-stats-card-row">
                <span className="quest-stats-card-label">Expires</span>
                <span className="quest-stats-card-value quest-stats-card-value--muted">
                  {new Date(quest.expiresAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            )}
            {quest.txId && (
              <div className="quest-stats-card-row quest-stats-card-row--tx">
                <span className="quest-stats-card-label">Creation Tx</span>
                <span className="tx-hash-value" style={{ fontSize: '0.75rem' }}>
                  {quest.txId.slice(0, 8)}…{quest.txId.slice(-6)}
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
