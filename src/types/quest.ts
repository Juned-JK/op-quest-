export const enum QuestType {
  // ── Normal (social / off-chain) ───────────────────────────────────────────
  Social    = 0, // Twitter / X
  Discord   = 1,
  Telegram  = 2,
  Community = 3, // Website / other
  // ── DeFi (on-chain) ───────────────────────────────────────────────────────
  Staking      = 4, // Stake tBTC on OPNet (StakingQuest contract)
  VaultDeposit = 5, // Deposit into VaultQuest contract (on-chain verified)
  TestnetTx    = 6, // Send a testnet transaction
}

/** Returns true for quest types that belong to the DeFi category */
export function isDefiQuestType(type: QuestType | undefined): boolean {
  return (
    type === QuestType.Staking ||
    type === QuestType.VaultDeposit ||
    type === QuestType.TestnetTx
  );
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  link: string;
  questType?: QuestType;
  createdBy: string;              // wallet address
  creatorName?: string;           // display name at time of creation
  createdAt: number;              // timestamp
  txId?: string;                  // on-chain creation transaction id
  contractAddress?: string;       // which contract owns this quest's on-chain data
                                  // undefined = legacy quests → use QUEST_TRACKER_ADDRESS

  // ── Staking quest fields (questType === QuestType.Staking only) ──────────
  minStakeAmount?: string;        // minimum tBTC to stake, in satoshis (bigint string)
  stakingContractAddress?: string;// StakingQuest contract address for this quest

  // ── Vault quest fields (questType === QuestType.VaultDeposit only) ────────
  minDepositAmount?: string;      // minimum tBTC to deposit, in satoshis (bigint string)
  vaultContractAddress?: string;  // VaultQuest contract address for this quest

  // ── Expiry ────────────────────────────────────────────────────────────────
  expiresAt?: number;             // Unix timestamp ms — undefined = never expires
}

/**
 * Shared callback type for the Complete button across all components.
 * Returns the on-chain txId on success, or null if already completed / no txId.
 */
export type OnCompleteCallback = (
  questId: string,
  questTitle: string,
  onProgress: (msg: string) => void,
) => Promise<string | null>;

export interface QuestCompletion {
  questId: string;
  walletAddress: string;
  signature: string;
  completedAt: number;
}
