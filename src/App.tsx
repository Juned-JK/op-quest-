import { useCallback, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { WalletBar } from './components/WalletBar';
import { useTheme } from './hooks/useTheme';
import { HomePage } from './pages/HomePage';
import { CreatorPage } from './pages/CreatorPage';
import { ProfilePage } from './pages/ProfilePage';
import { CreateQuestPage } from './pages/CreateQuestPage';
import { QuestPage } from './pages/QuestPage';
import { AboutPage } from './pages/AboutPage';
import { StatsPage } from './pages/StatsPage';
import { QuestCompleteAnimation } from './components/QuestCompleteAnimation';
import { TxMonitor } from './components/TxMonitor';
import { useTxMonitor } from './hooks/useTxMonitor';
import { useQuests } from './hooks/useQuests';
import { useDisplayName } from './hooks/useDisplayName';
import { useAvatar } from './hooks/useAvatar';
import { isAdminWallet } from './config/admin';
import { useQuestContract, isContractEnabled } from './hooks/useQuestContract';
import { useStakingQuest } from './hooks/useStakingQuest';
import { useVaultQuest } from './hooks/useVaultQuest';
import { useOnChainStatus } from './hooks/useOnChainCounts';
import { useReactions } from './hooks/useReactions';
import type { ReactionType } from './hooks/useReactions';
import { fetchQuestsFromDb, saveQuestToDb, updateQuestInDb, deleteQuestFromDb } from './hooks/useSupabaseQuests';
import { QuestType } from './types/quest';
import type { Quest } from './types/quest';

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [completionAnim,  setCompletionAnim]  = useState<{ title: string; txId: string | null } | null>(null);
  // questId → current status message for in-flight completions
  const [inFlightQuests, setInFlightQuests] = useState<Record<string, string>>({});
  const { walletAddress, publicKey, address, provider } = useWalletConnect();
  const isConnected = publicKey !== null;
  const isAdmin     = isAdminWallet(walletAddress);

  const {
    quests,
    setQuestsFromChain,
    addQuestObject,
    updateQuestInState,
    removeQuest,
    completeQuest,
    isCompleted,
    getCompletionCount,
    loading: questsLoading,
    setLoading: setQuestsLoading,
    getCompletionsForQuest,
  } = useQuests();

  // Stable quest-id string — used as dep in all three fetch effects
  const questIds = useMemo(() => quests.map((q) => q.id).join(','), [quests]);

  // O(1) quest lookup for isCompletedEffective
  const questById = useMemo(() => new Map(quests.map((q) => [q.id, q])), [quests]);

  const { displayName, saveDisplayName, clearDisplayName, getDisplayNameFor } =
    useDisplayName(walletAddress);

  const { avatar, saveAvatar, clearAvatar, getAvatarFor, prefetchAvatars } = useAvatar(walletAddress);

  const {
    completeQuestOnChain,
    updateQuestOnChain,
    deleteQuestOnChain,
    fetchQuestsFromChain,
    getOnChainCount,
    isCompletedOnChain,
  } = useQuestContract(address, walletAddress, provider);

  const {
    stakeForQuest,
    withdrawStake,
    getStakeBalance,
    checkHasStaked,
  } = useStakingQuest(address, walletAddress, provider);

  const {
    depositForQuest,
    withdrawDeposit,
    getDepositBalance,
    checkHasDeposited,
  } = useVaultQuest(address, walletAddress, provider);

  const { reactionCounts, myReactions, toggleReaction } = useReactions(walletAddress);

  const { txs: trackedTxs, addTx: addTrackedTx, updateTx: updateTrackedTx, removeTx: removeTrackedTx } = useTxMonitor();

  const handleReact = useCallback(
    (questId: string, type: ReactionType) => { toggleReaction(questId, type); },
    [toggleReaction],
  );

  const { onChainCompleted, onChainCounts, refresh } = useOnChainStatus(
    quests,
    walletAddress,
    isCompletedOnChain,
    getOnChainCount,
    isContractEnabled(),
  );

  // ── Staking on-chain state ────────────────────────────────────────────────
  const [onChainStaked, setOnChainStaked]   = useState<Record<string, boolean>>({});
  const [stakeBalances, setStakeBalances]   = useState<Record<string, bigint>>({});

  // ── Vault on-chain state ──────────────────────────────────────────────────
  const [onChainDeposited, setOnChainDeposited] = useState<Record<string, boolean>>({});
  const [depositBalances, setDepositBalances]   = useState<Record<string, bigint>>({});

  // ── Fetch vault deposit status when wallet connects ───────────────────────
  useEffect(() => {
    if (!walletAddress) {
      setOnChainDeposited({});
      setDepositBalances({});
      return;
    }

    const vaultQuests = quests.filter((q) => q.questType === QuestType.VaultDeposit);
    if (vaultQuests.length === 0) return;

    let cancelled = false;

    Promise.all(
      vaultQuests.map(async (q) => {
        const contractAddr = q.vaultContractAddress || undefined;
        const [deposited, balance] = await Promise.all([
          checkHasDeposited(q.id, contractAddr),
          getDepositBalance(q.id, contractAddr),
        ]);
        return { id: q.id, deposited, balance };
      }),
    ).then((results) => {
      if (cancelled) return;
      setOnChainDeposited((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.deposited !== null) next[r.id] = r.deposited;
        }
        return next;
      });
      setDepositBalances((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.balance !== null) next[r.id] = r.balance;
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, questIds]);

  // ── Fetch staking status for all staking quests when wallet connects ──────
  useEffect(() => {
    if (!walletAddress) {
      setOnChainStaked({});
      setStakeBalances({});
      return;
    }

    const stakingQuests = quests.filter((q) => q.questType === QuestType.Staking);
    if (stakingQuests.length === 0) return;

    let cancelled = false;

    Promise.all(
      stakingQuests.map(async (q) => {
        const contractAddr = q.stakingContractAddress || undefined;
        const [staked, balance] = await Promise.all([
          checkHasStaked(q.id, contractAddr),
          getStakeBalance(q.id, contractAddr),
        ]);
        return { id: q.id, staked, balance };
      }),
    ).then((results) => {
      if (cancelled) return;
      setOnChainStaked((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.staked !== null) next[r.id] = r.staked;
        }
        return next;
      });
      setStakeBalances((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.balance !== null) next[r.id] = r.balance;
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  // Re-run when the quest list changes (new staking quest added) or wallet changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, questIds]);

  // ── Fetch quests on mount (DB + chain in parallel) ────────────────────────
  useEffect(() => {
    let cancelled = false;
    setQuestsLoading(true);

    Promise.all([fetchQuestsFromDb(), fetchQuestsFromChain()]).then(
      ([dbQuests, chainQuests]) => {
        if (cancelled) return;
        const byId = new Map(dbQuests.map((q) => [q.id, q]));
        for (const cq of chainQuests) byId.set(cq.id, cq); // chain overwrites DB
        setQuestsFromChain([...byId.values()]);
        setQuestsLoading(false);
      },
    ).catch(() => { if (!cancelled) setQuestsLoading(false); });

    return () => { cancelled = true; };
  // Re-fetch when the wallet connects so the provider upgrade is used.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ── Prefetch creator avatars from Supabase when quest list changes ────────
  useEffect(() => {
    const addresses = [...new Set(quests.map((q) => q.createdBy))];
    void prefetchAvatars(addresses);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questIds]);

  // ── Completion timestamp lookup ───────────────────────────────────────────
  const getCompletedAt = useCallback(
    (questId: string): number | undefined => {
      if (!walletAddress) return undefined;
      return getCompletionsForQuest(questId).find((c) => c.walletAddress === walletAddress)?.completedAt;
    },
    [walletAddress, getCompletionsForQuest],
  );

  // ── Effective completion check ────────────────────────────────────────────
  // Staking quests use hasStaked (StakingQuest contract).
  // Other quests use isCompleted (QuestTracker contract).
  // Both fall back to localStorage when on-chain data is unavailable.
  const isCompletedEffective = useCallback(
    (questId: string, addr: string | null): boolean => {
      const quest = questById.get(questId);

      if (quest?.questType === QuestType.Staking) {
        if (addr && addr === walletAddress && questId in onChainStaked) {
          return onChainStaked[questId];
        }
      } else if (quest?.questType === QuestType.VaultDeposit) {
        if (addr && addr === walletAddress && questId in onChainDeposited) {
          return onChainDeposited[questId];
        }
      } else {
        if (addr && addr === walletAddress && questId in onChainCompleted) {
          return onChainCompleted[questId];
        }
      }

      return isCompleted(questId, addr);
    },
    [questById, onChainCompleted, onChainStaked, onChainDeposited, isCompleted, walletAddress],
  );

  // ── Quest completion ──────────────────────────────────────────────────────

  const handleComplete = async (
    questId: string,
    questTitle: string,
    onProgress: (msg: string) => void,
  ): Promise<string | null> => {
    if (!walletAddress) return null;

    addTrackedTx(questId, questTitle);

    // Track progress at App level so status survives page navigation
    const trackProgress = (msg: string) => {
      setInFlightQuests((prev) => ({ ...prev, [questId]: msg }));
      updateTrackedTx(questId, { progressMsg: msg });
      onProgress(msg);
    };
    setInFlightQuests((prev) => ({ ...prev, [questId]: 'Starting…' }));
    const clearInFlight = () =>
      setInFlightQuests((prev) => { const next = { ...prev }; delete next[questId]; return next; });

    const quest = quests.find((q) => q.id === questId);

    // ── Staking quest ─────────────────────────────────────────────────────
    if (quest?.questType === QuestType.Staking) {
      const stakeAmount  = BigInt(quest.minStakeAmount ?? '1000');
      const contractAddr = quest.stakingContractAddress || undefined;

      let stakeTxId: string | null = null;
      try {
        const { txId } = await stakeForQuest(questId, stakeAmount, trackProgress, contractAddr);
        stakeTxId = txId;
        updateTrackedTx(questId, { txId, status: 'confirmed', progressMsg: 'Stake confirmed!' });
        completeQuest(questId, walletAddress, txId);

        const [staked, balance] = await Promise.all([
          checkHasStaked(questId, contractAddr),
          getStakeBalance(questId, contractAddr),
        ]);
        if (staked !== null)  setOnChainStaked((prev) => ({ ...prev, [questId]: staked }));
        if (balance !== null) setStakeBalances((prev) => ({ ...prev, [questId]: balance }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        clearInFlight();
        if (/already staked/i.test(msg)) {
          trackProgress('Already staked — syncing status…');
          updateTrackedTx(questId, { status: 'confirmed', progressMsg: 'Already staked — synced' });
        } else {
          updateTrackedTx(questId, { status: 'failed', progressMsg: msg });
          throw err;
        }
      }
      clearInFlight();
      if (stakeTxId) setCompletionAnim({ title: questTitle, txId: stakeTxId });
      return stakeTxId;
    }

    // ── Vault quest ───────────────────────────────────────────────────────
    if (quest?.questType === QuestType.VaultDeposit) {
      const depositAmount = BigInt(quest.minDepositAmount ?? '1000');
      const contractAddr  = quest.vaultContractAddress || undefined;

      let depositTxId: string | null = null;
      try {
        const { txId } = await depositForQuest(questId, depositAmount, trackProgress, contractAddr);
        depositTxId = txId;
        updateTrackedTx(questId, { txId, status: 'confirmed', progressMsg: 'Deposit confirmed!' });
        completeQuest(questId, walletAddress, txId);

        const [deposited, balance] = await Promise.all([
          checkHasDeposited(questId, contractAddr),
          getDepositBalance(questId, contractAddr),
        ]);
        if (deposited !== null) setOnChainDeposited((prev) => ({ ...prev, [questId]: deposited }));
        if (balance !== null)   setDepositBalances((prev) => ({ ...prev, [questId]: balance }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        clearInFlight();
        if (/already deposited/i.test(msg)) {
          trackProgress('Already deposited — syncing status…');
          updateTrackedTx(questId, { status: 'confirmed', progressMsg: 'Already deposited — synced' });
        } else {
          updateTrackedTx(questId, { status: 'failed', progressMsg: msg });
          throw err;
        }
      }
      clearInFlight();
      if (depositTxId) setCompletionAnim({ title: questTitle, txId: depositTxId });
      return depositTxId;
    }

    // ── Regular quest ─────────────────────────────────────────────────────
    const contractAddr = quest?.contractAddress;
    let regularTxId: string | null = null;

    try {
      const result = await completeQuestOnChain(questId, trackProgress, contractAddr);
      regularTxId = result.txId ?? null;
      updateTrackedTx(questId, { txId: regularTxId, status: 'confirmed', progressMsg: 'Quest confirmed on-chain!' });
      completeQuest(questId, walletAddress, result.txId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      clearInFlight();
      if (/already completed/i.test(msg)) {
        trackProgress('Already completed — syncing status…');
        updateTrackedTx(questId, { status: 'confirmed', progressMsg: 'Already completed — synced' });
      } else {
        updateTrackedTx(questId, { status: 'failed', progressMsg: msg });
        throw err;
      }
    }

    await refresh(questId, contractAddr);
    clearInFlight();
    setCompletionAnim({ title: questTitle, txId: regularTxId });
    return regularTxId;
  };

  // ── Stake withdrawal ──────────────────────────────────────────────────────

  const handleWithdraw = useCallback(
    async (questId: string, onProgress: (msg: string) => void): Promise<string | null> => {
      if (!walletAddress) return null;
      const quest = quests.find((q) => q.id === questId);

      if (quest?.questType === QuestType.VaultDeposit) {
        const contractAddr = quest.vaultContractAddress || undefined;
        const { txId } = await withdrawDeposit(questId, onProgress, contractAddr);
        setDepositBalances((prev) => ({ ...prev, [questId]: 0n }));
        const balance = await getDepositBalance(questId, contractAddr);
        if (balance !== null) setDepositBalances((prev) => ({ ...prev, [questId]: balance }));
        return txId;
      }

      // Default: staking withdrawal
      const contractAddr = quest?.stakingContractAddress || undefined;
      const { txId } = await withdrawStake(questId, onProgress, contractAddr);
      setStakeBalances((prev) => ({ ...prev, [questId]: 0n }));
      const balance = await getStakeBalance(questId, contractAddr);
      if (balance !== null) setStakeBalances((prev) => ({ ...prev, [questId]: balance }));
      return txId;
    },
    [walletAddress, quests, withdrawStake, getStakeBalance, withdrawDeposit, getDepositBalance],
  );

  // ── Quest creation ────────────────────────────────────────────────────────

  const handleQuestCreated = useCallback(
    (quest: Quest) => {
      addQuestObject(quest);
      saveQuestToDb(quest);
    },
    [addQuestObject],
  );

  // ── Quest edit (owner-only, on-chain tx + DB) ─────────────────────────────

  const handleQuestUpdated = useCallback(
    async (
      updatedQuest: Quest,
      onProgress: (msg: string) => void,
    ): Promise<void> => {
      if (!walletAddress) throw new Error('Wallet not connected');
      await updateQuestOnChain(
        updatedQuest.id,
        updatedQuest.title,
        updatedQuest.description,
        updatedQuest.link,
        updatedQuest.questType ?? 0,
        onProgress,
        updatedQuest.contractAddress,
      );
      updateQuestInState(updatedQuest);
      await updateQuestInDb(updatedQuest);
    },
    [walletAddress, updateQuestOnChain, updateQuestInState],
  );

  // ── Quest delete (owner-only, on-chain tx + DB) ───────────────────────────

  const handleQuestDeleted = useCallback(
    async (
      questId: string,
      onProgress: (msg: string) => void,
    ): Promise<void> => {
      if (!walletAddress) throw new Error('Wallet not connected');
      const contractAddr = quests.find((q) => q.id === questId)?.contractAddress;
      await deleteQuestOnChain(questId, onProgress, contractAddr);
      removeQuest(questId);
      await deleteQuestFromDb(questId);
    },
    [walletAddress, quests, deleteQuestOnChain, removeQuest],
  );

  // ── Admin ─────────────────────────────────────────────────────────────────

  const handleDelete = (questId: string) => {
    if (!isAdmin) return;
    removeQuest(questId);
  };

  // Merge stakeBalances and depositBalances into a single map for QuestCard
  const allDepositBalances = useMemo(
    () => ({ ...stakeBalances, ...depositBalances }),
    [stakeBalances, depositBalances],
  );

  const visibleQuests = useMemo(() => {
    const now = Date.now();
    return quests.filter((q) => q.expiresAt == null || q.expiresAt > now);
  }, [quests]);

  const questListProps = useMemo(() => ({
    quests: visibleQuests,
    walletAddress,
    isConnected,
    isAdmin,
    isCompleted: isCompletedEffective,
    getCompletionCount,
    onChainCounts,
    stakeBalances: allDepositBalances,
    loading: questsLoading,
    reactionCounts,
    myReactions,
    onReact: handleReact,
    getCompletedAt,
    inFlightQuests,
    onComplete: handleComplete,
    onWithdraw: handleWithdraw,
    onDelete: handleDelete,
    onEdit: handleQuestUpdated,
    onOwnerDelete: handleQuestDeleted,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visibleQuests, walletAddress, isConnected, isAdmin, isCompletedEffective,
       getCompletionCount, onChainCounts, allDepositBalances, questsLoading,
       reactionCounts, myReactions, handleReact, getCompletedAt, inFlightQuests,
       handleWithdraw, handleDelete, handleQuestUpdated, handleQuestDeleted]);

  return (
    <div className="app">
      {completionAnim && (
        <QuestCompleteAnimation
          questTitle={completionAnim.title}
          txId={completionAnim.txId}
          onDismiss={() => setCompletionAnim(null)}
        />
      )}
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">OPQuest<span className="logo-text-fi">Fi</span></span>
            <span className="logo-badge">Bitcoin L1</span>
          </Link>
          <nav className="header-nav">
            <NavLink to="/" end className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}>Quests</NavLink>
            <NavLink to="/stats"  className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}>Stats</NavLink>
            <NavLink to="/about"  className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}>About</NavLink>
          </nav>
          <WalletBar avatar={avatar || undefined} theme={theme} onToggleTheme={toggleTheme} />
        </div>
      </header>

      {/* Fixed bottom tab bar — visible only on mobile */}
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <span className="mobile-nav-icon">⚡</span>
          <span className="mobile-nav-label">Quests</span>
        </NavLink>
        <NavLink to="/stats"  className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <span className="mobile-nav-icon">📊</span>
          <span className="mobile-nav-label">Stats</span>
        </NavLink>
        <NavLink to="/about"  className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <span className="mobile-nav-icon">ℹ️</span>
          <span className="mobile-nav-label">About</span>
        </NavLink>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              {...questListProps}
              getDisplayNameFor={getDisplayNameFor}
              getAvatarFor={getAvatarFor}
            />
          }
        />
        <Route
          path="/create"
          element={
            <CreateQuestPage
              onQuestCreated={handleQuestCreated}
              displayName={displayName}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              walletAddress={walletAddress}
              isConnected={isConnected}
              displayName={displayName}
              avatar={avatar}
              quests={quests}
              isCompleted={isCompletedEffective}
              onSaveName={saveDisplayName}
              onClearName={clearDisplayName}
              onSaveAvatar={saveAvatar}
              onClearAvatar={clearAvatar}
            />
          }
        />
        <Route
          path="/creator/:creatorId"
          element={
            <CreatorPage
              {...questListProps}
              getDisplayNameFor={getDisplayNameFor}
              getAvatarFor={getAvatarFor}
            />
          }
        />
        <Route
          path="/quest/:questId"
          element={
            <QuestPage
              {...questListProps}
              getDisplayNameFor={getDisplayNameFor}
              getAvatarFor={getAvatarFor}
              getCompletionsForQuest={getCompletionsForQuest}
            />
          }
        />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>

      <TxMonitor txs={trackedTxs} onRemove={removeTrackedTx} />

      <footer className="app-footer">
        <span>Built on OPNet · Bitcoin Layer 1 Smart Contracts</span>
        <a
          className="footer-x-link"
          href="https://x.com/OPQuestBTC"
          target="_blank"
          rel="noopener noreferrer"
        >
          𝕏 @OPQuestBTC
        </a>
      </footer>
    </div>
  );
}
