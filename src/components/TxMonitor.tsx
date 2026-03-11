import { useEffect, useRef, useState } from 'react';
import type { TrackedTx } from '../hooks/useTxMonitor';

interface Props {
  txs: TrackedTx[];
  onRemove: (questId: string) => void;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

const EXPLORER_BASE = 'https://testnet.opnet.org';

export function TxMonitor({ txs, onRemove }: Props) {
  const pendingCount = txs.filter((t) => t.status === 'pending').length;
  const [open, setOpen] = useState(false);
  // Tick every second to update elapsed times
  const [, setTick] = useState(0);
  const prevLenRef = useRef(txs.length);

  // Auto-open when a new tx is added
  useEffect(() => {
    if (txs.length > prevLenRef.current) {
      setOpen(true);
    }
    prevLenRef.current = txs.length;
  }, [txs.length]);

  // Live timer — only runs while there are pending txs
  useEffect(() => {
    if (pendingCount === 0) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [pendingCount]);

  return (
    <div className={`tx-monitor${open ? ' tx-monitor--open' : ''}`} role="status" aria-live="polite">

      {/* ── Pill / header — always visible ── */}
      <button
        className="tx-monitor-pill"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Transaction monitor"
      >
        <span className="tx-monitor-pill-left">
          {pendingCount > 0
            ? <span className="tx-pill-spin" aria-hidden="true" />
            : <span className="tx-pill-icon" aria-hidden="true">⚡</span>
          }
          <span className="tx-pill-label">Txns</span>
        </span>
        <span className="tx-pill-right">
          {pendingCount > 0
            ? <span className="tx-pill-badge tx-pill-badge--pending">{pendingCount}</span>
            : <span className="tx-pill-badge tx-pill-badge--idle">{txs.length}</span>
          }
          <span className="tx-pill-chevron">{open ? '▼' : '▲'}</span>
        </span>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div className="tx-monitor-panel">
          {txs.length === 0 ? (
            <div className="tx-monitor-empty">
              <p className="tx-empty-icon">📭</p>
              <p className="tx-empty-text">No recent transactions</p>
              <p className="tx-empty-sub">Transactions appear here when you complete quests</p>
            </div>
          ) : (
            <div className="tx-monitor-list">
              {txs.map((tx) => {
                const elapsed = Date.now() - tx.startedAt;
                return (
                  <div key={tx.questId} className={`tx-item tx-item--${tx.status}`}>
                    <div className="tx-item-row">
                      {/* Status icon */}
                      <span className="tx-item-icon" aria-hidden="true">
                        {tx.status === 'pending'   && <span className="tx-spin" />}
                        {tx.status === 'confirmed' && <span className="tx-icon-ok">✓</span>}
                        {tx.status === 'failed'    && <span className="tx-icon-fail">✕</span>}
                      </span>

                      {/* Title + timer */}
                      <span className="tx-item-info">
                        <span className="tx-item-title">{tx.questTitle}</span>
                        <span className="tx-item-time">{formatElapsed(elapsed)}</span>
                      </span>

                      {/* Dismiss — only for done/failed */}
                      {tx.status !== 'pending' && (
                        <button
                          className="tx-item-dismiss"
                          onClick={() => onRemove(tx.questId)}
                          aria-label="Dismiss"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Progress message */}
                    <p className="tx-item-msg">{tx.progressMsg}</p>

                    {/* Explorer link */}
                    {tx.txId && (
                      <a
                        className="tx-item-link"
                        href={`${EXPLORER_BASE}/tx/${tx.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tx.txId.slice(0, 8)}…{tx.txId.slice(-6)}&nbsp;↗
                      </a>
                    )}

                    {/* Pending info note */}
                    {tx.status === 'pending' && (
                      <p className="tx-item-note">Bitcoin blocks take ~2–5 min on testnet</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
