import { useLiveStats } from '../hooks/useLiveStats';

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBig(n: number): string {
  if (n >= 1_000_000_000_000) return `$${fmt(n / 1_000_000_000_000)}T`;
  if (n >= 1_000_000_000)     return `$${fmt(n / 1_000_000_000)}B`;
  if (n >= 1_000_000)         return `$${fmt(n / 1_000_000)}M`;
  return `$${fmt(n)}`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeSince(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface StatCardProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  accent?: boolean;
}

function StatCard({ title, icon, children, accent }: StatCardProps) {
  return (
    <div className={`stats-card${accent ? ' stats-card--accent' : ''}`}>
      <div className="stats-card-header">
        <span className="stats-card-icon">{icon}</span>
        <span className="stats-card-title">{title}</span>
      </div>
      <div className="stats-card-body">{children}</div>
    </div>
  );
}

interface RowProps { label: string; value: string; sub?: string; highlight?: boolean }
function Row({ label, value, sub, highlight }: RowProps) {
  return (
    <div className="stats-row">
      <span className="stats-row-label">{label}</span>
      <span className={`stats-row-value${highlight ? ' stats-row-value--highlight' : ''}`}>
        {value}
        {sub && <span className="stats-row-sub">{sub}</span>}
      </span>
    </div>
  );
}

export function StatsPage() {
  const { btcMarket, btcFees, btcBlock, btcMempool, opnet, lastUpdated, loading, error, refresh } = useLiveStats();

  const priceUp = (btcMarket?.change24h ?? 0) >= 0;

  return (
    <main className="stats-page">
      <div className="stats-page-header">
        <div>
          <h1 className="stats-page-title">Live Network Stats</h1>
          <p className="stats-page-sub">Real-time Bitcoin & OPNet data · auto-refreshes every 30s</p>
        </div>
        <div className="stats-refresh-row">
          {lastUpdated && (
            <span className="stats-last-updated">Updated {fmtTime(lastUpdated)}</span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Updating…</> : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="stats-error">{error}</p>}

      <div className="stats-grid">

        {/* BTC Price — big card */}
        <StatCard title="Bitcoin Price" icon="₿" accent>
          {btcMarket ? (
            <>
              <div className="stats-price-big">
                ${btcMarket.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                <span className={`stats-change${priceUp ? ' stats-change--up' : ' stats-change--down'}`}>
                  {priceUp ? '▲' : '▼'} {Math.abs(btcMarket.change24h).toFixed(2)}%
                </span>
              </div>
              <div className="stats-price-sub">24h change</div>
              <div className="stats-divider" />
              <Row label="Market Cap"   value={fmtBig(btcMarket.marketCap)} />
              <Row label="24h Volume"   value={fmtBig(btcMarket.volume24h)} />
            </>
          ) : (
            <div className="stats-loading-placeholder" />
          )}
        </StatCard>

        {/* OPNet Network */}
        <StatCard title="OPNet Testnet" icon="⚡">
          {opnet ? (
            <>
              <Row label="Block Height"    value={opnet.blockNumber.toLocaleString()} highlight />
              <Row label="Current Epoch"   value={`#${opnet.epochNumber}`} />
              <Row label="Epoch Blocks"    value={`${opnet.epochStartBlock} → ${opnet.epochEndBlock}`} />
              <div className="stats-divider" />
              <Row label="Mempool Txs"     value={opnet.mempoolCount.toLocaleString()} />
              <Row label="OPNet Txs"       value={opnet.opnetMempoolCount.toLocaleString()} highlight />
            </>
          ) : (
            <>
              <div className="stats-loading-placeholder" />
              <div className="stats-loading-placeholder" />
              <div className="stats-loading-placeholder" />
            </>
          )}
        </StatCard>

        {/* Bitcoin Fees */}
        <StatCard title="Bitcoin Fees (sat/vB)" icon="💸">
          {btcFees ? (
            <>
              <div className="stats-fee-grid">
                <div className="stats-fee-item stats-fee-item--fast">
                  <span className="stats-fee-label">Fast</span>
                  <span className="stats-fee-value">{btcFees.fastest}</span>
                  <span className="stats-fee-unit">sat/vB</span>
                  <span className="stats-fee-time">~10 min</span>
                </div>
                <div className="stats-fee-item stats-fee-item--medium">
                  <span className="stats-fee-label">Medium</span>
                  <span className="stats-fee-value">{btcFees.halfHour}</span>
                  <span className="stats-fee-unit">sat/vB</span>
                  <span className="stats-fee-time">~30 min</span>
                </div>
                <div className="stats-fee-item stats-fee-item--slow">
                  <span className="stats-fee-label">Slow</span>
                  <span className="stats-fee-value">{btcFees.economy}</span>
                  <span className="stats-fee-unit">sat/vB</span>
                  <span className="stats-fee-time">~1 hr+</span>
                </div>
              </div>
              <p className="stats-fee-note">Mainnet fees · source: mempool.space</p>
            </>
          ) : (
            <div className="stats-loading-placeholder" />
          )}
        </StatCard>

        {/* Latest Bitcoin Block */}
        <StatCard title="Latest Bitcoin Block" icon="⛏️">
          {btcBlock ? (
            <>
              <div className="stats-block-height">
                #{btcBlock.height.toLocaleString()}
                <span className="stats-block-age">{timeSince(btcBlock.timestamp)}</span>
              </div>
              <div className="stats-divider" />
              <Row label="Transactions" value={btcBlock.txCount.toLocaleString()} highlight />
              <Row label="Block Size"   value={`${btcBlock.sizeMB.toFixed(2)} MB`} />
              <Row label="Miner"        value={btcBlock.miner} />
            </>
          ) : (
            <>
              <div className="stats-loading-placeholder" />
              <div className="stats-loading-placeholder" />
            </>
          )}
        </StatCard>

        {/* Mempool */}
        <StatCard title="Bitcoin Mempool" icon="🌊">
          {btcMempool ? (
            <>
              <div className="stats-congestion-row">
                <span className="stats-congestion-label">Congestion</span>
                <span className={`stats-congestion-badge stats-congestion-badge--${btcMempool.congestion}`}>
                  {btcMempool.congestion.toUpperCase()}
                </span>
              </div>
              <div className="stats-mempool-bar-wrap">
                <div
                  className={`stats-mempool-bar stats-mempool-bar--${btcMempool.congestion}`}
                  style={{ width: `${Math.min(100, (btcMempool.vsizeMB / 30) * 100)}%` }}
                />
              </div>
              <div className="stats-divider" />
              <Row label="Pending Txs"   value={btcMempool.count.toLocaleString()} highlight />
              <Row label="Mempool Size"  value={`${btcMempool.vsizeMB.toFixed(2)} MB`} />
              <Row label="Pending Fees"  value={`${btcMempool.totalFeeBTC.toFixed(4)} BTC`} />
            </>
          ) : (
            <>
              <div className="stats-loading-placeholder" />
              <div className="stats-loading-placeholder" />
            </>
          )}
        </StatCard>

        {/* OPNet Advantage */}
        <StatCard title="OPNet Advantage" icon="🔒">
          <div className="stats-advantage-list">
            <div className="stats-advantage-item">
              <span className="stats-advantage-icon">⚡</span>
              <div>
                <strong>Zero Gas</strong>
                <p>OPNet contract calls don't require gas fees — just a standard Bitcoin transaction.</p>
              </div>
            </div>
            <div className="stats-advantage-item">
              <span className="stats-advantage-icon">🔐</span>
              <div>
                <strong>Post-Quantum Security</strong>
                <p>ML-DSA signatures protect every quest completion — quantum-resistant by design.</p>
              </div>
            </div>
            <div className="stats-advantage-item">
              <span className="stats-advantage-icon">₿</span>
              <div>
                <strong>Bitcoin Native</strong>
                <p>Every OPQuestFi action is a real Bitcoin transaction on the most secure L1 in existence.</p>
              </div>
            </div>
          </div>
        </StatCard>

      </div>

      <p className="stats-disclaimer">
        BTC price from CoinGecko · Bitcoin fees, blocks & mempool from mempool.space · OPNet data from testnet.opnet.org
      </p>
    </main>
  );
}
