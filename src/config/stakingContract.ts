import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';
import { OPNET_TESTNET_RPC } from './contract';

// ── Staking contract address ─────────────────────────────────────────────────
// Set this to the deployed StakingQuest.wasm address after deployment.
// Leave empty to disable staking quests until the contract is live.
export const STAKING_QUEST_ADDRESS: string = 'opt1sqpn9rkdrh6xdw0sdw3a6hqlff2vy3d35c5cey5fr';

export const isStakingContractEnabled = (): boolean => STAKING_QUEST_ADDRESS !== '';

// ── Default minimum stake ────────────────────────────────────────────────────
// 1 000 satoshis = 0.00001 tBTC — small enough to not be a burden on testnet.
export const DEFAULT_MIN_STAKE_SATS = 1_000n;

// Re-export so consumers don't need two imports
export { OPNET_TESTNET_RPC };

// ── ABI ───────────────────────────────────────────────────────────────────────
export const StakingQuestAbi: BitcoinInterfaceAbi = [
  // ── stake ─────────────────────────────────────────────────────────────────
  {
    name: 'stake',
    payable: true,
    inputs: [
      { name: 'questId',      type: ABIDataTypes.STRING  },
      { name: 'minAmountSat', type: ABIDataTypes.UINT256 },
    ],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── withdraw ──────────────────────────────────────────────────────────────
  {
    name: 'withdraw',
    inputs: [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── getStakeBalance ───────────────────────────────────────────────────────
  {
    name: 'getStakeBalance',
    constant: true,
    inputs: [
      { name: 'questId', type: ABIDataTypes.STRING  },
      { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── hasStaked ─────────────────────────────────────────────────────────────
  {
    name: 'hasStaked',
    constant: true,
    inputs: [
      { name: 'questId', type: ABIDataTypes.STRING  },
      { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'staked', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── getTotalStaked ────────────────────────────────────────────────────────
  {
    name: 'getTotalStaked',
    constant: true,
    inputs: [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'total', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  ...OP_NET_ABI,
] as BitcoinInterfaceAbi;
