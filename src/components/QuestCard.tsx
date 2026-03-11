import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactionCounts, ReactionType } from '../hooks/useReactions';
import { QuestType, isDefiQuestType } from '../types/quest';
import type { Quest } from '../types/quest';
import { DEFAULT_MIN_STAKE_SATS } from '../config/stakingContract';
import { DEFAULT_MIN_DEPOSIT_SATS } from '../config/vaultContract';

interface QuestCardProps {
  quest: Quest;
  isConnected: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  completed: boolean;
  completionCount: number;
  onChainCount?: number | null;
  /** Current on-chain stake balance in satoshis. Only relevant for staking quests. */
  stakeBalance?: bigint | null;
  /** Timestamp (ms) when the current wallet completed this quest. */
  completedAt?: number;
  /** Set by App when a completion tx is in-flight — survives page navigation. */
  inFlightStatus?: string;
  onComplete: (
    questId: string,
    questTitle: string,
    onProgress: (msg: string) => void,
  ) => Promise<string | null>;
  onWithdraw?: (questId: string, onProgress: (msg: string) => void) => Promise<string | null>;
  reactionCounts?: ReactionCounts;
  myReaction?: { fire: boolean; like: boolean };
  onReact?: (questId: string, type: ReactionType) => void;
  onDelete: (questId: string) => void;
  onEdit: (updatedQuest: Quest, onProgress: (msg: string) => void) => Promise<void>;
  onOwnerDelete: (questId: string, onProgress: (msg: string) => void) => Promise<void>;
}

const QUEST_TYPES: { type: QuestType; icon: string; label: string }[] = [
  { type: QuestType.Social,       icon: '𝕏',  label: 'Social'        },
  { type: QuestType.Discord,      icon: '💬', label: 'Discord'       },
  { type: QuestType.Telegram,     icon: '✈️', label: 'Telegram'      },
  { type: QuestType.Community,    icon: '⚡', label: 'Community'     },
  { type: QuestType.Staking,      icon: '💰', label: 'Staking'       },
  { type: QuestType.VaultDeposit, icon: '🏦', label: 'Vault Deposit' },
  { type: QuestType.TestnetTx,    icon: '🔗', label: 'Testnet Tx'    },
];

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function creatorLabel(quest: { createdBy: string; creatorName?: string }): string | null {
  if (quest.createdBy === 'system') return 'OPNet Team';
  return quest.creatorName || shortAddress(quest.createdBy);
}

function getQuestIcon(quest: Pick<Quest, 'link' | 'questType'>): string {
  if (quest.questType !== undefined) {
    if (quest.questType === QuestType.Social)       return '𝕏';
    if (quest.questType === QuestType.Discord)      return '💬';
    if (quest.questType === QuestType.Telegram)     return '✈️';
    if (quest.questType === QuestType.Staking)      return '💰';
    if (quest.questType === QuestType.VaultDeposit) return '🏦';
    if (quest.questType === QuestType.TestnetTx)    return '🔗';
    return '⚡';
  }
  const lower = quest.link.toLowerCase();
  if (lower.includes('x.com') || lower.includes('twitter.com')) return '𝕏';
  if (lower.includes('discord.gg') || lower.includes('discord.com')) return '💬';
  if (lower.includes('t.me') || lower.includes('telegram')) return '✈️';
  return '⚡';
}

function formatExpiry(ts: number): string {
  const diffMs = ts - Date.now();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffHours < 24) {
    const h = diffHours;
    const m = diffMins % 60;
    return h > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${m}m`;
  }
  if (diffDays < 7) return `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `Expires ${new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatCompletedAt(ts: number): string {
  const d = new Date(ts);
  return 'Completed ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function isExpiryUrgent(ts: number): boolean {
  return ts - Date.now() < 86_400_000; // < 24h
}

function formatSats(sats: bigint): string {
  if (sats >= 100_000_000n) return `${(Number(sats) / 1e8).toFixed(4)} tBTC`;
  if (sats >= 1_000n)       return `${Number(sats).toLocaleString()} sats`;
  return `${sats} sats`;
}

function minStakeAmount(quest: Quest): bigint {
  return BigInt(quest.minStakeAmount ?? String(DEFAULT_MIN_STAKE_SATS));
}

function minDepositAmount(quest: Quest): bigint {
  return BigInt(quest.minDepositAmount ?? String(DEFAULT_MIN_DEPOSIT_SATS));
}

const isStakingQuest     = (quest: Quest) => quest.questType === QuestType.Staking;
const isVaultDepositQuest = (quest: Quest) => quest.questType === QuestType.VaultDeposit;

export const QuestCard = memo(function QuestCard({
  quest,
  isConnected,
  isAdmin,
  isOwner,
  completed,
  completedAt,
  completionCount,
  onChainCount,
  stakeBalance,
  inFlightStatus,
  reactionCounts,
  myReaction,
  onReact,
  onComplete,
  onWithdraw,
  onDelete,
  onEdit,
  onOwnerDelete,
}: QuestCardProps) {
  const [loading, setLoading]     = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── TX hash display after stake / deposit / withdraw ─────────────────────
  const [lastTxId, setLastTxId]   = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);


  const handleCopyTx = () => {
    if (!lastTxId) return;
    navigator.clipboard.writeText(lastTxId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Withdraw state (staking quests) ──────────────────────────────────────
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawStatus, setWithdrawStatus]   = useState('');
  const [withdrawError, setWithdrawError]     = useState<string | null>(null);

  // ── Edit state ───────────────────────────────────────────────────────────
  const [showEdit, setShowEdit]   = useState(false);
  const [editType, setEditType]   = useState<QuestType>(quest.questType ?? QuestType.Social);
  const [editTitle, setEditTitle] = useState(quest.title);
  const [editDesc, setEditDesc]   = useState(quest.description);
  const [editLink, setEditLink]   = useState(quest.link);
  const [editLoading, setEditLoading] = useState(false);
  const [editStatus, setEditStatus]   = useState('');
  const [editError, setEditError]     = useState<string | null>(null);

  // ── Owner delete state ───────────────────────────────────────────────────
  const [confirmOwnerDelete, setConfirmOwnerDelete] = useState(false);
  const [deleteLoading, setDeleteLoading]           = useState(false);
  const [deleteStatus, setDeleteStatus]             = useState('');

  const isInFlight = !!inFlightStatus;

  const handleComplete = async () => {
    if (!isConnected || completed || loading || isInFlight) return;
    setError(null);
    setLastTxId(null);
    setStatusMsg(
      isStakingQuest(quest)      ? 'Preparing stake…'   :
      isVaultDepositQuest(quest) ? 'Preparing deposit…' :
      'Starting…'
    );
    setLoading(true);
    try {
      const txId = await onComplete(quest.id, quest.title, setStatusMsg);
      if (txId) setLastTxId(txId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const handleWithdraw = async () => {
    if (!onWithdraw || withdrawLoading) return;
    setWithdrawError(null);
    setLastTxId(null);
    setWithdrawLoading(true);
    setWithdrawStatus('Preparing withdrawal…');
    try {
      const txId = await onWithdraw(quest.id, setWithdrawStatus);
      if (txId) setLastTxId(txId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed.';
      setWithdrawError(msg);
    } finally {
      setWithdrawLoading(false);
      setWithdrawStatus('');
    }
  };

  // Admin delete (instant, no tx)
  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete(quest.id);
  };

  // Owner delete (on-chain tx required)
  const handleOwnerDeleteClick = async () => {
    if (!confirmOwnerDelete) {
      setConfirmOwnerDelete(true);
      setTimeout(() => setConfirmOwnerDelete(false), 4000);
      return;
    }
    setConfirmOwnerDelete(false);
    setDeleteLoading(true);
    setDeleteStatus('Starting…');
    setError(null);
    try {
      await onOwnerDelete(quest.id, setDeleteStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed.';
      setError(msg);
      setDeleteLoading(false);
      setDeleteStatus('');
    }
  };

  // Toggle edit panel — reset fields to current quest values each time
  const handleEditToggle = () => {
    if (!showEdit) {
      setEditType(quest.questType ?? QuestType.Social);
      setEditTitle(quest.title);
      setEditDesc(quest.description);
      setEditLink(quest.link);
      setEditError(null);
      setEditStatus('');
    }
    setShowEdit((v) => !v);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLoading || !editTitle.trim() || !editLink.trim()) return;

    setEditError(null);
    setEditLoading(true);
    setEditStatus('Preparing…');

    const updatedQuest: Quest = {
      ...quest,
      title: editTitle.trim(),
      description: editDesc.trim(),
      link: editLink.trim(),
      questType: editType,
    };

    try {
      await onEdit(updatedQuest, setEditStatus);
      setShowEdit(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed.';
      setEditError(msg);
    } finally {
      setEditLoading(false);
      setEditStatus('');
    }
  };

  const canSubmitEdit = editTitle.trim().length > 0 && editLink.trim().length > 0 && !editLoading;

  // ── Quest type derived values ─────────────────────────────────────────────
  const isStaking      = isStakingQuest(quest);
  const isVaultDeposit = isVaultDepositQuest(quest);
  const isDefi         = isDefiQuestType(quest.questType);

  const minSats        = isStaking      ? minStakeAmount(quest)  :
                         isVaultDeposit ? minDepositAmount(quest) : 0n;

  // stakeBalance prop carries vault deposit balance too (merged in App.tsx).
  // Show withdraw when balance is unknown (undefined = fetch pending/failed) OR > 0.
  // Only hide it when balance is explicitly 0n — meaning the user already withdrew.
  const hasActiveBalance = (isStaking || isVaultDeposit) && stakeBalance !== 0n;
  const hasWithdrawn     = (isStaking || isVaultDeposit) && completed && stakeBalance === 0n;
  // Hide on-chain count for staking/vault quests (QuestTracker count is irrelevant)
  const effectiveOnChainCount = (isStaking || isVaultDeposit) ? null : onChainCount;

  const typeClass = quest.questType !== undefined ? `quest-card--t${quest.questType}` : '';

  return (
    <div className={`quest-card ${typeClass} ${completed ? 'quest-card--completed' : ''} ${isStaking ? 'quest-card--staking' : ''} ${isDefi && !isStaking ? 'quest-card--defi' : ''}`}>
      <div className="quest-card-icon">{getQuestIcon(quest)}</div>

      <div className="quest-card-body">
        <div className="quest-card-header">
          <h3 className="quest-card-title">{quest.title}</h3>
          <div className="quest-card-badges">
            {completed && <span className="badge badge-success">✓ Done</span>}
            {completed && completedAt && (
              <span className="quest-completed-at" title={new Date(completedAt).toLocaleString()}>
                {formatCompletedAt(completedAt)}
              </span>
            )}
            {isStaking && <span className="badge badge-staking">💰 Staking</span>}
            {quest.questType === QuestType.VaultDeposit && <span className="badge badge-defi">🏦 DeFi</span>}
            {quest.questType === QuestType.TestnetTx    && <span className="badge badge-defi">🔗 DeFi</span>}
            {quest.expiresAt && (
              <span className={`badge badge-expiry${isExpiryUrgent(quest.expiresAt) ? ' badge-expiry--urgent' : ''}`}>
                ⏳ {formatExpiry(quest.expiresAt)}
              </span>
            )}

            {/* Owner controls */}
            {isOwner && !isAdmin && (
              <>
                <button
                  className="btn-icon"
                  onClick={handleEditToggle}
                  title={showEdit ? 'Cancel edit' : 'Edit quest'}
                  disabled={deleteLoading}
                >
                  {showEdit ? '✕' : '✏️'}
                </button>
                <button
                  className={`btn-delete ${confirmOwnerDelete ? 'btn-delete--confirm' : ''}`}
                  onClick={handleOwnerDeleteClick}
                  disabled={deleteLoading}
                  title={confirmOwnerDelete ? 'Click again to confirm delete (requires tx)' : 'Delete quest'}
                >
                  {deleteLoading
                    ? <><span className="spinner" /> {deleteStatus}</>
                    : confirmOwnerDelete ? '⚠ Confirm' : '🗑'}
                </button>
              </>
            )}

            {/* Admin controls */}
            {isAdmin && (
              <button
                className={`btn-delete ${confirmDelete ? 'btn-delete--confirm' : ''}`}
                onClick={handleDeleteClick}
                title={confirmDelete ? 'Click again to confirm delete' : 'Delete quest (admin)'}
              >
                {confirmDelete ? '⚠ Confirm' : '🗑'}
              </button>
            )}
          </div>
        </div>

        {quest.description && <p className="quest-card-desc">{quest.description}</p>}

        {/* Staking info banner */}
        {isStaking && (
          <div className="staking-info">
            <span className="staking-info-icon">🔒</span>
            <span className="staking-info-text">
              Stake <strong>{formatSats(minSats)}</strong> tBTC on OPNet testnet to complete.
              {' '}Withdraw your stake anytime.
            </span>
          </div>
        )}

        {/* Vault deposit info banner */}
        {isVaultDeposit && (
          <div className="staking-info staking-info--vault">
            <span className="staking-info-icon">🏦</span>
            <span className="staking-info-text">
              Deposit <strong>{formatSats(minSats)}</strong> tBTC into the vault to complete.
              {' '}Withdraw your deposit anytime.
            </span>
          </div>
        )}

        {/* Active stake balance */}
        {isStaking && stakeBalance != null && stakeBalance > 0n && (
          <div className="stake-balance">
            <span>Staked: <strong>{formatSats(stakeBalance)}</strong></span>
          </div>
        )}
        {/* Active vault deposit balance */}
        {isVaultDeposit && stakeBalance != null && stakeBalance > 0n && (
          <div className="stake-balance stake-balance--vault">
            <span>Deposited: <strong>{formatSats(stakeBalance)}</strong></span>
          </div>
        )}
        {hasWithdrawn && (
          <div className="stake-balance stake-balance--withdrawn">
            <span>{isVaultDeposit ? 'Deposit withdrawn ✓' : 'Stake withdrawn ✓'}</span>
          </div>
        )}

        <div className="quest-card-footer">
          <div className="quest-card-meta">
            <span className="quest-creator-inline">
              by <span className="quest-creator-name">{creatorLabel(quest)}</span>
            </span>
            <span className="quest-meta-dot">·</span>
            <span className="quest-completions">
              {effectiveOnChainCount != null ? (
                <><strong>{effectiveOnChainCount}</strong> {effectiveOnChainCount === 1 ? 'user' : 'users'}</>
              ) : (
                <><strong>{completionCount}</strong> {completionCount === 1 ? 'completion' : 'completions'}</>
              )}
            </span>
            {quest.link && quest.link !== '#' && (
              <a className="quest-link" href={quest.link} target="_blank" rel="noopener noreferrer">
                {(isStaking || isVaultDeposit) ? 'Learn more ↗' : 'Open ↗'}
              </a>
            )}
            <Link className="quest-link" to={`/quest/${quest.id}`}>Details →</Link>
          </div>

          <div className="quest-card-actions">

            {/* Complete / Stake / Deposit button */}
            {!completed && (
              <button
                className={`btn btn-primary btn-sm ${isStaking || isVaultDeposit ? 'btn-stake' : ''}`}
                onClick={handleComplete}
                disabled={!isConnected || loading || isInFlight}
                title={!isConnected ? 'Connect wallet to complete quests' : undefined}
              >
                {(loading || isInFlight) ? (
                  <>
                    <span className="spinner" /> {statusMsg || inFlightStatus || 'Sending…'}
                  </>
                ) : isStaking ? (
                  `Stake ${formatSats(minSats)}`
                ) : isVaultDeposit ? (
                  `Deposit ${formatSats(minSats)}`
                ) : (
                  'Complete'
                )}
              </button>
            )}

            {/* Withdraw button — shown when quest is completed and balance is active */}
            {completed && (isStaking || isVaultDeposit) && hasActiveBalance && onWithdraw && (
              <button
                className="btn btn-sm btn-withdraw"
                onClick={handleWithdraw}
                disabled={withdrawLoading}
                title={isVaultDeposit ? 'Withdraw your deposited tBTC' : 'Withdraw your staked tBTC'}
              >
                {withdrawLoading ? (
                  <><span className="spinner" /> {withdrawStatus || 'Withdrawing…'}</>
                ) : isVaultDeposit ? (
                  'Withdraw Deposit'
                ) : (
                  'Withdraw Stake'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Reaction buttons */}

        <div className="quest-reactions">
          <button
            className={`reaction-btn${myReaction?.fire ? ' reaction-btn--active' : ''}`}
            onClick={() => onReact?.(quest.id, 'fire')}
            title="Fire"
          >
            🔥 <span className="reaction-count">{reactionCounts?.fire ?? 0}</span>
          </button>
          <button
            className={`reaction-btn${myReaction?.like ? ' reaction-btn--active' : ''}`}
            onClick={() => onReact?.(quest.id, 'like')}
            title="Like"
          >
            👍 <span className="reaction-count">{reactionCounts?.like ?? 0}</span>
          </button>
        </div>

        {error && <p className="quest-error">{error}</p>}
        {withdrawError && <p className="quest-error">{withdrawError}</p>}

        {/* ── TX hash display ──────────────────────────────────────────── */}
        {lastTxId && (
          <div className="tx-hash-row">
            <span className="tx-hash-label">Tx</span>
            <span className="tx-hash-value">
              {lastTxId.slice(0, 8)}…{lastTxId.slice(-6)}
            </span>
            <button className="tx-copy-btn" onClick={handleCopyTx} title="Copy full transaction hash">
              {copied ? '✓' : '⧉'}
            </button>
            {copied && <span className="tx-copied-msg">Copied!</span>}
          </div>
        )}

        {/* ── Inline edit form ────────────────────────────────────────── */}
        {showEdit && (
          <form className="quest-edit-panel" onSubmit={handleEditSubmit} noValidate>
            <p className="quest-edit-title">Edit Quest</p>

            {/* Quest type */}
            <div className="quest-type-row">
              {QUEST_TYPES.map(({ type, icon, label }) => (
                <button
                  key={type}
                  type="button"
                  className={`quest-type-chip${editType === type ? ' quest-type-chip--active' : ''}`}
                  onClick={() => setEditType(type)}
                  disabled={editLoading}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={`edit-title-${quest.id}`}>Title *</label>
              <input
                id={`edit-title-${quest.id}`}
                className="form-input"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={80}
                disabled={editLoading}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={`edit-desc-${quest.id}`}>Description</label>
              <textarea
                id={`edit-desc-${quest.id}`}
                className="form-input form-textarea"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={200}
                rows={2}
                disabled={editLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={`edit-link-${quest.id}`}>Link *</label>
              <input
                id={`edit-link-${quest.id}`}
                className="form-input"
                type="url"
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                disabled={editLoading}
              />
            </div>

            {editError && <p className="quest-error">{editError}</p>}

            <div className="quest-edit-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!canSubmitEdit}
              >
                {editLoading ? (
                  <><span className="spinner" /> {editStatus || 'Saving…'}</>
                ) : (
                  'Save on OPNet'
                )}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleEditToggle}
                disabled={editLoading}
              >
                Cancel
              </button>
            </div>

            {editLoading && (
              <p className="quest-hint">Keep this page open while the transaction confirms.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
});
