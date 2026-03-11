import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { useQuestContract } from '../hooks/useQuestContract';
import { QUEST_CREATOR_ADDRESS, isCreatorContractEnabled } from '../config/contract';
import { STAKING_QUEST_ADDRESS, DEFAULT_MIN_STAKE_SATS } from '../config/stakingContract';
import { VAULT_QUEST_ADDRESS, DEFAULT_MIN_DEPOSIT_SATS } from '../config/vaultContract';
import { QuestType } from '../types/quest';
import type { Quest } from '../types/quest';

type QuestCategory = 'normal' | 'defi';

const NORMAL_QUEST_TYPES: { type: QuestType; icon: string; label: string; hint: string }[] = [
  { type: QuestType.Social,    icon: '𝕏',  label: 'Twitter / X', hint: 'Follow, repost, or engage on X' },
  { type: QuestType.Discord,   icon: '💬', label: 'Discord',      hint: 'Join or engage in Discord'      },
  { type: QuestType.Telegram,  icon: '✈️', label: 'Telegram',     hint: 'Join a Telegram group or channel' },
  { type: QuestType.Community, icon: '⚡', label: 'Community',    hint: 'Website visit or other task'    },
];

const DEFI_QUEST_TYPES: { type: QuestType; icon: string; label: string; hint: string }[] = [
  { type: QuestType.Staking,      icon: '💰', label: 'Staking',        hint: 'Stake tBTC on OPNet'         },
  { type: QuestType.VaultDeposit, icon: '🏦', label: 'Vault Deposit',  hint: 'Deposit into a vault or pool' },
];

// ── Quest Templates ────────────────────────────────────────────────────────
interface QuestTemplate {
  id: string;
  icon: string;
  label: string;
  questType: QuestType;
  title: string;
  description: string;
  link: string;
  minStakeSats?: string;
  minDepositSats?: string;
}

const NORMAL_TEMPLATES: QuestTemplate[] = [
  {
    id: 'follow-x',
    icon: '𝕏',
    label: 'Follow on X',
    questType: QuestType.Social,
    title: 'Follow Us on X',
    description: 'Follow the official account on X (Twitter) to stay updated with the latest news and announcements.',
    link: 'https://x.com/',
  },
  {
    id: 'retweet',
    icon: '🔁',
    label: 'Retweet',
    questType: QuestType.Social,
    title: 'Retweet Our Latest Post',
    description: 'Retweet our latest announcement on X to help spread the word to the community.',
    link: 'https://x.com/',
  },
  {
    id: 'join-discord',
    icon: '💬',
    label: 'Join Discord',
    questType: QuestType.Discord,
    title: 'Join Our Discord Server',
    description: 'Join our official Discord community server and introduce yourself in #general.',
    link: 'https://discord.gg/',
  },
  {
    id: 'verify-discord',
    icon: '✅',
    label: 'Verify in Discord',
    questType: QuestType.Discord,
    title: 'Verify Your Wallet in Discord',
    description: 'Join our Discord server and complete wallet verification to unlock exclusive member channels.',
    link: 'https://discord.gg/',
  },
  {
    id: 'join-telegram',
    icon: '✈️',
    label: 'Join Telegram',
    questType: QuestType.Telegram,
    title: 'Join Our Telegram Group',
    description: 'Join our official Telegram group to receive real-time updates, announcements, and community discussion.',
    link: 'https://t.me/',
  },
  {
    id: 'visit-website',
    icon: '🌐',
    label: 'Visit Website',
    questType: QuestType.Community,
    title: 'Visit Our Official Website',
    description: 'Explore our official website to learn about our mission, roadmap, and how to get started.',
    link: 'https://',
  },
  {
    id: 'try-testnet',
    icon: '🔗',
    label: 'Try Testnet',
    questType: QuestType.Community,
    title: 'Try OPNet Testnet',
    description: 'Visit the OPNet testnet and explore Bitcoin Layer 1 smart contracts live on the network.',
    link: 'https://testnet.opnet.org',
  },
  {
    id: 'read-docs',
    icon: '📖',
    label: 'Read Docs',
    questType: QuestType.Community,
    title: 'Read the OPNet Documentation',
    description: 'Visit the OPNet docs to learn how Bitcoin L1 smart contracts work and how to build on OPNet.',
    link: 'https://docs.opnet.org',
  },
];

const DEFI_TEMPLATES: QuestTemplate[] = [
  {
    id: 'stake-basic',
    icon: '💰',
    label: 'Stake tBTC',
    questType: QuestType.Staking,
    title: 'Stake tBTC on OPNet',
    description: 'Stake a small amount of tBTC on the OPNet testnet to experience Bitcoin L1 DeFi firsthand.',
    link: '',
    minStakeSats: '1000',
  },
  {
    id: 'stake-power',
    icon: '⚡',
    label: 'Power Stake',
    questType: QuestType.Staking,
    title: 'Become a Power Staker',
    description: 'Stake 10,000 satoshis or more to join the OPNet power staker tier and support Bitcoin L1 DeFi.',
    link: '',
    minStakeSats: '10000',
  },
  {
    id: 'stake-community',
    icon: '🤝',
    label: 'Community Stake',
    questType: QuestType.Staking,
    title: 'Support the Community — Stake tBTC',
    description: 'Stake tBTC to show your commitment to the OPNet ecosystem and Bitcoin Layer 1 DeFi.',
    link: '',
    minStakeSats: '5000',
  },
  {
    id: 'vault-first',
    icon: '🏦',
    label: 'First Deposit',
    questType: QuestType.VaultDeposit,
    title: 'Make Your First Vault Deposit',
    description: 'Deposit tBTC into the OPNet vault to explore Bitcoin L1 DeFi yield strategies firsthand.',
    link: '',
    minDepositSats: '1000',
  },
  {
    id: 'vault-explorer',
    icon: '🔍',
    label: 'Vault Explorer',
    questType: QuestType.VaultDeposit,
    title: 'Explore Vault Deposits on OPNet',
    description: 'Deposit into the OPNet vault contract and watch your funds work on Bitcoin Layer 1.',
    link: '',
    minDepositSats: '5000',
  },
];

interface CreateQuestPageProps {
  onQuestCreated: (quest: Quest) => void;
  displayName: string | null;
}

export function CreateQuestPage({ onQuestCreated, displayName }: CreateQuestPageProps) {
  const navigate = useNavigate();
  const { walletAddress, address, provider, publicKey } = useWalletConnect();
  const isConnected = publicKey !== null;

  const { createQuestOnChain } = useQuestContract(address, walletAddress, provider);

  const [step, setStep]                   = useState<'category' | 'form'>('category');
  const [category, setCategory]           = useState<QuestCategory>('normal');
  const [questType, setQuestType]         = useState<QuestType>(QuestType.Social);
  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [link, setLink]                   = useState('');
  const [minStakeSats, setMinStakeSats]     = useState(String(DEFAULT_MIN_STAKE_SATS));
  const [minDepositSats, setMinDepositSats] = useState(String(DEFAULT_MIN_DEPOSIT_SATS));
  const [expiryDate, setExpiryDate]         = useState('');
  const [loading, setLoading]               = useState(false);
  const [statusMsg, setStatusMsg]         = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const isStaking      = questType === QuestType.Staking;
  const isVaultDeposit = questType === QuestType.VaultDeposit;
  const activeQuestTypes = category === 'normal' ? NORMAL_QUEST_TYPES : DEFI_QUEST_TYPES;
  const activeTemplates  = category === 'normal' ? NORMAL_TEMPLATES   : DEFI_TEMPLATES;

  const selectCategory = (cat: QuestCategory) => {
    setCategory(cat);
    setQuestType(cat === 'normal' ? QuestType.Social : QuestType.Staking);
    setActiveTemplateId(null);
    setStep('form');
  };

  const applyTemplate = (tpl: QuestTemplate) => {
    if (activeTemplateId === tpl.id) {
      // Second click clears the template
      setActiveTemplateId(null);
      return;
    }
    setActiveTemplateId(tpl.id);
    setQuestType(tpl.questType);
    setTitle(tpl.title);
    setDescription(tpl.description);
    setLink(tpl.link);
    if (tpl.minStakeSats)   setMinStakeSats(tpl.minStakeSats);
    if (tpl.minDepositSats) setMinDepositSats(tpl.minDepositSats);
  };

  // Link is optional for staking and vault quests (they don't need a social link)
  const linkRequired = !isStaking && !isVaultDeposit;
  const canSubmit =
    isConnected &&
    title.trim().length > 0 &&
    (linkRequired ? link.trim().length > 0 : true) &&
    !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !walletAddress) return;

    setError(null);
    setLoading(true);
    setStatusMsg('Preparing…');

    const questId = `quest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Staking quests use '#' as a placeholder link if none is provided
    const effectiveLink = link.trim() || '#';

    try {
      const { txId } = await createQuestOnChain(
        questId,
        title.trim(),
        description.trim(),
        effectiveLink,
        questType,
        setStatusMsg,
      );

      const quest: Quest = {
        id: questId,
        title: title.trim(),
        description: description.trim(),
        link: effectiveLink,
        questType,
        createdBy: walletAddress,
        creatorName: displayName || undefined,
        createdAt: Date.now(),
        txId,
        contractAddress: QUEST_CREATOR_ADDRESS,
        // Staking-specific fields
        ...(isStaking && {
          minStakeAmount: minStakeSats || String(DEFAULT_MIN_STAKE_SATS),
          stakingContractAddress: STAKING_QUEST_ADDRESS || undefined,
        }),
        // Vault-specific fields
        ...(isVaultDeposit && {
          minDepositAmount: minDepositSats || String(DEFAULT_MIN_DEPOSIT_SATS),
          vaultContractAddress: VAULT_QUEST_ADDRESS || undefined,
        }),
        // Expiry
        ...(expiryDate && { expiresAt: new Date(expiryDate).getTime() }),
      };

      onQuestCreated(quest);
      navigate(`/creator/${walletAddress}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      setLoading(false);
      setStatusMsg('');
    }
  };

  if (!isCreatorContractEnabled()) {
    return (
      <main className="app-main">
        <div className="create-page-header">
          <Link to="/" className="back-link">← All Creators</Link>
          <h1 className="create-page-title">Create Quest</h1>
        </div>
        <div className="create-page-body">
          <div className="info-card" style={{ maxWidth: 480 }}>
            <h3 className="info-card-title">Coming Soon</h3>
            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              On-chain quest creation is not yet available — the creator contract
              has not been deployed. Existing quests and completions are
              unaffected and continue to work normally.
            </p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
              ← Back to Quests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (step === 'category') {
    return (
      <main className="app-main">
        <div className="create-page-header">
          <Link to="/" className="back-link">← All Creators</Link>
          <h1 className="create-page-title">Create Quest</h1>
          <p className="create-page-sub">What kind of quest do you want to create?</p>
        </div>

        <div className="category-select-body">
          <button
            className="category-card category-card--normal"
            onClick={() => selectCategory('normal')}
          >
            <span className="category-card-icon">🌐</span>
            <span className="category-card-label">Normal Quest</span>
            <span className="category-card-desc">
              Social tasks like follow on X, join Discord, join Telegram, or visit a website.
            </span>
            <span className="category-card-types">
              𝕏 Twitter &nbsp;·&nbsp; 💬 Discord &nbsp;·&nbsp; ✈️ Telegram &nbsp;·&nbsp; ⚡ Community
            </span>
          </button>

          <button
            className="category-card category-card--defi"
            onClick={() => selectCategory('defi')}
          >
            <span className="category-card-icon">⛓️</span>
            <span className="category-card-label">DeFi Quest</span>
            <span className="category-card-desc">
              On-chain actions like staking tBTC, depositing into a vault, or sending a testnet transaction.
            </span>
            <span className="category-card-types">
              💰 Staking &nbsp;·&nbsp; 🏦 Vault Deposit
            </span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="create-page-header">
        <button className="back-link" onClick={() => setStep('category')}>← Back</button>
        <h1 className="create-page-title">
          {category === 'normal' ? '🌐 Normal Quest' : '⛓️ DeFi Quest'}
        </h1>
        <p className="create-page-sub">
          Register a new community quest permanently on OPNet Bitcoin L1.
        </p>
      </div>

      <div className="create-page-body">
        <form className="create-page-form" onSubmit={handleSubmit} noValidate>

          {/* ── Template Picker ──────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">
              Start from a Template
              <span className="template-label-hint"> — click to pre-fill the form</span>
            </label>
            <div className="template-picker">
              {activeTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`template-chip${activeTemplateId === tpl.id ? ' template-chip--active' : ''}`}
                  onClick={() => applyTemplate(tpl)}
                  disabled={loading}
                  title={tpl.title}
                >
                  <span className="template-chip-icon">{tpl.icon}</span>
                  <span className="template-chip-label">{tpl.label}</span>
                  {activeTemplateId === tpl.id && (
                    <span className="template-chip-clear">✕</span>
                  )}
                </button>
              ))}
            </div>
            {activeTemplateId && (
              <p className="template-applied-hint">
                Template applied — all fields are editable. Click the active template again to clear.
              </p>
            )}
          </div>

          {/* Quest Type */}
          <div className="form-group">
            <label className="form-label">
              Quest Type <span className="required">*</span>
            </label>
            <div className="quest-type-grid">
              {activeQuestTypes.map(({ type, icon, label, hint }) => (
                <button
                  key={type}
                  type="button"
                  className={`quest-type-btn${questType === type ? ' quest-type-btn--active' : ''}`}
                  onClick={() => setQuestType(type)}
                  disabled={loading}
                >
                  <span className="quest-type-icon">{icon}</span>
                  <span className="quest-type-label">{label}</span>
                  <span className="quest-type-hint">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="cq-title">
              Title <span className="required">*</span>
            </label>
            <input
              id="cq-title"
              className="form-input"
              type="text"
              placeholder={
                isStaking      ? 'e.g. Stake tBTC to Support OP Quest' :
                isVaultDeposit ? 'e.g. Deposit into the OPNet Vault' :
                'e.g. Follow us on X'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              disabled={loading || !isConnected}
              autoComplete="off"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="cq-desc">
              Description
            </label>
            <textarea
              id="cq-desc"
              className="form-input form-textarea"
              placeholder={
                isStaking      ? 'Why should users stake? What is the purpose? (optional)' :
                isVaultDeposit ? 'Describe the vault and what funds are used for (optional)' :
                'What should users do? (optional)'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              disabled={loading || !isConnected}
            />
          </div>

          {/* Staking-specific: minimum stake amount */}
          {isStaking && (
            <div className="form-group">
              <label className="form-label" htmlFor="cq-stake">
                Minimum Stake (satoshis) <span className="required">*</span>
              </label>
              <input
                id="cq-stake"
                className="form-input"
                type="number"
                min="546"
                step="1"
                placeholder={String(DEFAULT_MIN_STAKE_SATS)}
                value={minStakeSats}
                onChange={(e) => setMinStakeSats(e.target.value)}
                disabled={loading || !isConnected}
              />
              <p className="form-hint">
                Minimum tBTC (in satoshis) users must stake to complete this quest.
                546 sats is the dust limit; recommended: 1 000–10 000 sats.
              </p>
            </div>
          )}

          {/* Vault-specific: minimum deposit amount */}
          {isVaultDeposit && (
            <div className="form-group">
              <label className="form-label" htmlFor="cq-deposit">
                Minimum Deposit (satoshis) <span className="required">*</span>
              </label>
              <input
                id="cq-deposit"
                className="form-input"
                type="number"
                min="546"
                step="1"
                placeholder={String(DEFAULT_MIN_DEPOSIT_SATS)}
                value={minDepositSats}
                onChange={(e) => setMinDepositSats(e.target.value)}
                disabled={loading || !isConnected}
              />
              <p className="form-hint">
                Minimum tBTC (in satoshis) users must deposit into the vault to complete this quest.
                Recommended: 1 000–10 000 sats. Users can withdraw their deposit anytime.
              </p>
            </div>
          )}

          {/* Link — optional for staking / vault quests */}
          <div className="form-group">
            <label className="form-label" htmlFor="cq-link">
              {linkRequired ? 'Link *' : 'Link (optional)'}
            </label>
            <input
              id="cq-link"
              className="form-input"
              type="url"
              placeholder={
                isStaking      ? 'https://opnet.org (optional info link)' :
                isVaultDeposit ? 'https://opnet.org (optional info link)' :
                'https://x.com/yourhandle'
              }
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={loading || !isConnected}
            />
          </div>

          {/* Expiry date */}
          <div className="form-group">
            <label className="form-label" htmlFor="cq-expiry">
              Expiry Date (optional)
            </label>
            <input
              id="cq-expiry"
              className="form-input"
              type="datetime-local"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              disabled={loading || !isConnected}
            />
            <p className="form-hint">
              If set, the quest will automatically disappear after this date/time.
              Leave blank for a permanent quest.
            </p>
          </div>

          {/* Staking contract notice */}
          {isStaking && !STAKING_QUEST_ADDRESS && (
            <div className="form-hint form-hint--warning">
              ⚠ The staking contract has not been deployed yet. This quest will be stored on-chain
              but users will not be able to stake until deployment is complete.
            </div>
          )}

          {/* Vault contract notice */}
          {isVaultDeposit && !VAULT_QUEST_ADDRESS && (
            <div className="form-hint form-hint--warning">
              ⚠ The vault contract has not been deployed yet. This quest will be stored on-chain
              but users will not be able to deposit until deployment is complete.
            </div>
          )}

          {!isConnected && (
            <p className="form-hint">Connect your OPWallet to create a quest.</p>
          )}

          {error && <p className="quest-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={!canSubmit}
          >
            {loading ? (
              <><span className="spinner" /> {statusMsg || 'Sending…'}</>
            ) : (
              'Register Quest on OPNet'
            )}
          </button>

          {loading && (
            <p className="create-page-pending-hint">
              Keep this page open while the transaction confirms — this may take a few minutes.
            </p>
          )}
        </form>

        <aside className="create-page-info">
          {isStaking ? (
            <>
              <div className="info-card">
                <h3 className="info-card-title">How Staking Quests work</h3>
                <ol className="info-steps">
                  <li>Set a minimum tBTC amount users must stake</li>
                  <li>Users send tBTC to the StakingQuest contract</li>
                  <li>Quest is marked complete once the stake tx confirms</li>
                  <li>Users can withdraw their tBTC anytime via the quest card</li>
                </ol>
              </div>
              <div className="info-card">
                <h3 className="info-card-title">What gets stored on-chain</h3>
                <ul className="create-info-list">
                  <li>Quest metadata in QuestTracker (type = Staking)</li>
                  <li>Stake amounts and balances in StakingQuest contract</li>
                  <li>Permanent hasStaked flag per wallet (quest completion)</li>
                  <li>WithdrawnEvent emitted when users reclaim their tBTC</li>
                </ul>
              </div>
            </>
          ) : isVaultDeposit ? (
            <>
              <div className="info-card">
                <h3 className="info-card-title">How Vault Quests work</h3>
                <ol className="info-steps">
                  <li>Set a minimum tBTC deposit amount for users</li>
                  <li>Users deposit tBTC into the VaultQuest contract</li>
                  <li>Quest is marked complete once the deposit tx confirms</li>
                  <li>Users can withdraw their deposit anytime via the quest card</li>
                </ol>
              </div>
              <div className="info-card">
                <h3 className="info-card-title">What gets stored on-chain</h3>
                <ul className="create-info-list">
                  <li>Quest metadata in QuestTracker (type = VaultDeposit)</li>
                  <li>Deposit amounts and balances in VaultQuest contract</li>
                  <li>Permanent hasDeposited flag per wallet (quest completion)</li>
                  <li>VaultWithdrawnEvent emitted when users reclaim their tBTC</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="info-card">
                <h3 className="info-card-title">How it works</h3>
                <ol className="info-steps">
                  <li>Fill in the quest details and select a type</li>
                  <li>OPWallet prompts you to approve the transaction</li>
                  <li>The quest is registered on OPNet Bitcoin L1</li>
                  <li>Once confirmed, your quest appears on your creator page</li>
                </ol>
              </div>
              <div className="info-card">
                <h3 className="info-card-title">What gets stored on-chain</h3>
                <ul className="create-info-list">
                  <li>Your wallet address (creator)</li>
                  <li>Unique quest ID — prevents duplicate registration</li>
                  <li>Quest type (Social, Discord, Telegram, Community, Staking)</li>
                  <li>Title, description &amp; link — permanently in tx calldata</li>
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
