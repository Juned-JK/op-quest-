import { Link } from 'react-router-dom';

const TECH_STACK = [
  { icon: '₿',  label: 'Bitcoin L1',      desc: 'All quest data stored on the Bitcoin base layer via OPNet' },
  { icon: '⚙️', label: 'OPNet Contracts', desc: 'AssemblyScript smart contracts compiled to WASM, deployed on Bitcoin' },
  { icon: '🔐', label: 'ML-DSA Signing',  desc: 'Post-quantum signatures via OPWallet — no gas, no friction' },
  { icon: '⚡', label: 'React 19 + Vite', desc: 'Fast, modern frontend with full TypeScript safety' },
  { icon: '🗄️', label: 'Supabase',        desc: 'Off-chain metadata: reactions, display names, avatars' },
];

const ROADMAP = [
  { phase: '01', title: 'Foundation',   status: 'done',    items: ['Quest creation & completion on-chain', 'OPWallet ML-DSA signing', 'Staking & Vault DeFi quests', 'Creator profiles & groups'] },
  { phase: '02', title: 'Engagement',   status: 'done',    items: ['Reactions (fire/like)', 'Quest sort & filter', 'Quest detail pages', 'Quest templates', 'Eye care & light themes'] },
  { phase: '03', title: 'Rewards',      status: 'active',  items: ['On-chain reward pools (tBTC)', 'FCFS reward distribution', 'Raffle / random winner selection', 'Quest NFT completion badges'] },
  { phase: '04', title: 'Social Layer', status: 'planned', items: ['Leaderboards', 'Streak system (on-chain)', 'Completion certificates (shareable image)', 'Live activity feed'] },
  { phase: '05', title: 'Governance',   status: 'planned', items: ['Community quest voting', 'Creator reputation scores', 'DAO-style quest approval', 'On-chain analytics dashboard'] },
];

const STATS = [
  { value: '10+', label: 'Live Quests' },
  { value: '3',   label: 'DeFi Quest Types' },
  { value: '2',   label: 'Smart Contracts' },
  { value: 'L1',  label: 'Bitcoin Native' },
];

const HOW_IT_WORKS = [
  { n: '01', icon: '🔗', title: 'Connect OPWallet',  desc: 'Link your Bitcoin L1 wallet. No account creation. No email. Just your keys.' },
  { n: '02', icon: '📋', title: 'Pick a Quest',       desc: 'Browse Normal (social) or DeFi (on-chain) quests from the community.' },
  { n: '03', icon: '✍️', title: 'Complete & Sign',    desc: 'Hit Complete and sign with ML-DSA via OPWallet. No gas fee required.' },
  { n: '04', icon: '🔒', title: 'Stored on Bitcoin',  desc: 'Your completion is written to an OPNet smart contract on Bitcoin L1 — permanently.' },
  { n: '05', icon: '💰', title: 'Earn Rewards',       desc: 'Claim tBTC rewards from on-chain pools — coming in Phase 03.' },
];

export function AboutPage() {
  return (
    <main className="about-page">

      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero-badge">Built on OPNet · Bitcoin Layer 1</div>
        <h1 className="about-hero-title">
          The First Quest Platform<br />
          <span className="about-hero-accent">Native to Bitcoin L1</span>
        </h1>
        <p className="about-hero-sub">
          OPQuestFi lets anyone create, complete, and reward quests — all verified
          on Bitcoin's base layer through OPNet smart contracts. No gas, no bridges,
          no trust required.
        </p>
        <div className="about-hero-cta">
          <Link to="/" className="btn btn-primary">Browse Quests</Link>
          <a
            href="https://opnet.org"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            Learn About OPNet
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="about-stats">
        {STATS.map((s) => (
          <div key={s.label} className="about-stat">
            <span className="about-stat-value">{s.value}</span>
            <span className="about-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* Problem / Solution */}
      <section className="about-section">
        <div className="about-two-col">
          <div className="about-card about-card--problem">
            <div className="about-card-icon">⚠️</div>
            <h3 className="about-card-title">The Problem</h3>
            <ul className="about-card-list">
              <li>Quest platforms run on centralized servers — completions can be faked or deleted</li>
              <li>Rewards held in custodial wallets — trust the team or lose your funds</li>
              <li>Most "on-chain" quests only store hashes on EVM chains — not Bitcoin</li>
              <li>No real DeFi integration — quests are disconnected from actual protocol activity</li>
            </ul>
          </div>
          <div className="about-card about-card--solution">
            <div className="about-card-icon">✅</div>
            <h3 className="about-card-title">Our Solution</h3>
            <ul className="about-card-list">
              <li>Every completion is signed with ML-DSA and recorded permanently on Bitcoin L1</li>
              <li>DeFi quests (stake, vault) are verified by on-chain smart contracts — no faking</li>
              <li>Reward pools live in auditable OPNet contracts — no custodian needed</li>
              <li>Built directly on Bitcoin — the most secure, decentralized base layer in existence</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="about-section">
        <h2 className="about-section-title">How It Works</h2>
        <div className="about-steps">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.n} className="about-step">
              <div className="about-step-num">{step.n}</div>
              <div className="about-step-icon">{step.icon}</div>
              <h4 className="about-step-title">{step.title}</h4>
              <p className="about-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="about-section">
        <h2 className="about-section-title">Tech Stack</h2>
        <div className="about-tech-grid">
          {TECH_STACK.map((t) => (
            <div key={t.label} className="about-tech-card">
              <span className="about-tech-icon">{t.icon}</span>
              <strong className="about-tech-label">{t.label}</strong>
              <p className="about-tech-desc">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="about-section">
        <h2 className="about-section-title">Roadmap</h2>
        <div className="about-roadmap">
          {ROADMAP.map((phase) => (
            <div key={phase.phase} className={`about-phase about-phase--${phase.status}`}>
              <div className="about-phase-header">
                <span className="about-phase-num">Phase {phase.phase}</span>
                <span className={`about-phase-badge about-phase-badge--${phase.status}`}>
                  {phase.status === 'done' ? '✓ Done' : phase.status === 'active' ? 'In Progress' : 'Planned'}
                </span>
              </div>
              <h3 className="about-phase-title">{phase.title}</h3>
              <ul className="about-phase-items">
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Why Bitcoin L1 */}
      <section className="about-section about-section--highlight">
        <h2 className="about-section-title">Why Bitcoin L1?</h2>
        <p className="about-why-text">
          Bitcoin is the most secure, most decentralized, and most battle-tested blockchain in existence.
          OPNet brings Turing-complete smart contracts to Bitcoin's base layer using Tapscript-encoded
          calldata — without OP_RETURN, without inscriptions, and without sidechains.
          Every OPQuestFi completion is a real Bitcoin transaction. That's not a claim most quest
          platforms can make.
        </p>
        <div className="about-why-pills">
          {['No EVM', 'No Gas', 'No Bridges', 'No Custodians', 'Bitcoin Native', 'Post-Quantum Ready'].map((p) => (
            <span key={p} className="about-why-pill">{p}</span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta-section">
        <h2 className="about-cta-title">Ready to start?</h2>
        <p className="about-cta-sub">Connect your OPWallet and complete your first Bitcoin L1 quest.</p>
        <Link to="/" className="btn btn-primary btn-lg">Launch App</Link>
      </section>

    </main>
  );
}
