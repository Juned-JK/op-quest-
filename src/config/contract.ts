import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';

/**
 * Original contract — completeQuest / isCompleted / getCompletionCount.
 * All existing quests and their on-chain completion data live here.
 * NEVER change or remove this address; it is the source of truth for legacy quests.
 */
export const QUEST_TRACKER_ADDRESS: string = 'opt1sqq3rjyajjauuy4yrx5s2jyg9hhcv2z30xgzhczh2';

/**
 * New contract — adds createQuest (with metadata) / getQuestCount / getQuestAt
 * on top of all completion methods.
 * Update this address after each redeployment.
 */
export const QUEST_CREATOR_ADDRESS: string = 'opt1sqq3rjyajjauuy4yrx5s2jyg9hhcv2z30xgzhczh2';

export const isCreatorContractEnabled = () => QUEST_CREATOR_ADDRESS !== '';

/** OPNet testnet RPC endpoint */
export const OPNET_TESTNET_RPC = 'https://testnet.opnet.org';

export const QuestTrackerAbi: BitcoinInterfaceAbi = [
  // ── Quest creation ────────────────────────────────────────────────────────
  {
    name: 'createQuest',
    inputs: [
      { name: 'questId',     type: ABIDataTypes.STRING },
      { name: 'title',       type: ABIDataTypes.STRING },
      { name: 'description', type: ABIDataTypes.STRING },
      { name: 'link',        type: ABIDataTypes.STRING },
      { name: 'questType',   type: ABIDataTypes.UINT8  },
    ],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,
  {
    name: 'isRegistered',
    constant: true,
    inputs:  [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'registered', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── Quest listing (new) ───────────────────────────────────────────────────
  {
    name: 'getQuestCount',
    constant: true,
    inputs:  [],
    outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,
  {
    name: 'getQuestAt',
    constant: true,
    inputs:  [{ name: 'index', type: ABIDataTypes.UINT32 }],
    outputs: [
      { name: 'questId',     type: ABIDataTypes.STRING  },
      { name: 'title',       type: ABIDataTypes.STRING  },
      { name: 'description', type: ABIDataTypes.STRING  },
      { name: 'link',        type: ABIDataTypes.STRING  },
      { name: 'questType',   type: ABIDataTypes.UINT8   },
      { name: 'creator',     type: ABIDataTypes.ADDRESS },
      { name: 'createdAt',   type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── Quest edit / delete ───────────────────────────────────────────────────
  {
    name: 'updateQuestMetadata',
    inputs: [
      { name: 'questId',     type: ABIDataTypes.STRING },
      { name: 'title',       type: ABIDataTypes.STRING },
      { name: 'description', type: ABIDataTypes.STRING },
      { name: 'link',        type: ABIDataTypes.STRING },
      { name: 'questType',   type: ABIDataTypes.UINT8  },
    ],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,
  {
    name: 'deleteQuest',
    inputs:  [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── Quest completion ──────────────────────────────────────────────────────
  {
    name: 'completeQuest',
    inputs:  [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,
  {
    name: 'isCompleted',
    constant: true,
    inputs: [
      { name: 'questId', type: ABIDataTypes.STRING  },
      { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'completed', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,
  {
    name: 'getCompletionCount',
    constant: true,
    inputs:  [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  ...OP_NET_ABI,
] as BitcoinInterfaceAbi;
