import { useEffect, useState } from 'react';

interface Props {
  questTitle: string;
  txId: string | null;
  onDismiss: () => void;
}

type Phase = 'signing' | 'confirming' | 'done';

// Deterministic confetti colours cycling through brand palette
const CONFETTI_COLORS = ['#f7931a', '#22c55e', '#3b82f6', '#ffffff', '#f7931a', '#ef4444'];

export function QuestCompleteAnimation({ questTitle, txId, onDismiss }: Props) {
  const [phase, setPhase]       = useState<Phase>('signing');
  const [blockNum]              = useState(() => 4080 + Math.floor(Math.random() * 20));
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('confirming'), 1400);
    const t2 = setTimeout(() => setPhase('done'),       2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Auto-dismiss countdown once on "done" phase
  useEffect(() => {
    if (phase !== 'done') return;
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { clearInterval(interval); onDismiss(); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, onDismiss]);

  return (
    <div
      className="qca-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Quest completion"
      onClick={phase === 'done' ? onDismiss : undefined}
    >
      <div className="qca-card" onClick={(e) => e.stopPropagation()}>

        {/* ── Phase 1: Signing ─────────────────────────────────────── */}
        {phase === 'signing' && (
          <div className="qca-phase qca-phase--signing">
            <div className="qca-radar">
              <span className="qca-radar-ring qca-radar-ring--1" />
              <span className="qca-radar-ring qca-radar-ring--2" />
              <span className="qca-radar-ring qca-radar-ring--3" />
              <span className="qca-radar-core">₿</span>
            </div>
            <p className="qca-label">Signing with ML-DSA…</p>
            <p className="qca-sub">Post-quantum signature · Bitcoin L1</p>
          </div>
        )}

        {/* ── Phase 2: Block confirmation ──────────────────────────── */}
        {phase === 'confirming' && (
          <div className="qca-phase qca-phase--confirming">
            <div className="qca-blocks">
              <div className="qca-block qca-block--old">₿</div>
              <div className="qca-block qca-block--old qca-block--old2">₿</div>
              <div className="qca-block qca-block--new">⚡</div>
            </div>
            <p className="qca-label">Confirmed in block</p>
            <p className="qca-blocknum">#{blockNum.toLocaleString()}</p>
            <p className="qca-sub">OPNet Testnet · Bitcoin Layer 1</p>
          </div>
        )}

        {/* ── Phase 3: Done ────────────────────────────────────────── */}
        {phase === 'done' && (
          <div className="qca-phase qca-phase--done">
            {/* Confetti */}
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="qca-confetti"
                style={{
                  '--ci':    i,
                  '--cx':    `${(Math.random() * 160) - 80}px`,
                  '--cy':    `${-(Math.random() * 120 + 40)}px`,
                  '--cr':    `${Math.random() * 360}deg`,
                  '--cd':    `${Math.random() * 0.4}s`,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                } as React.CSSProperties}
              />
            ))}

            <div className="qca-checkmark">✓</div>
            <p className="qca-done-title">Quest Complete!</p>
            <p className="qca-done-quest">{questTitle}</p>

            {txId && (
              <div className="qca-tx-row">
                <span className="qca-tx-label">Tx</span>
                <span className="qca-tx-hash">{txId.slice(0, 10)}…{txId.slice(-8)}</span>
              </div>
            )}

            <p className="qca-sub">Proven on Bitcoin Layer 1 ⚡</p>

            <button className="qca-continue-btn" onClick={onDismiss}>
              Continue
              <span className="qca-countdown"> ({countdown})</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
