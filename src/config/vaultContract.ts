import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';
import { OPNET_TESTNET_RPC } from './contract';

// ── Vault contract address ────────────────────────────────────────────────────
// Set this to the deployed VaultQuest.wasm address after deployment.
// Leave empty to disable vault quests until the contract is live.
export const VAULT_QUEST_ADDRESS: string = 'opt1sqphatjptl02vtsnmt3rv4scgyh2nu42hcy97fk0v';

export const isVaultContractEnabled = (): boolean => VAULT_QUEST_ADDRESS !== '';

// ── Default minimum deposit ───────────────────────────────────────────────────
// 1 000 satoshis — same as staking minimum for testnet
export const DEFAULT_MIN_DEPOSIT_SATS = 1_000n;

// Re-export so consumers don't need two imports
export { OPNET_TESTNET_RPC };

// ── ABI ────────────────────────────────────────────────────────────────────────
export const VaultQuestAbi: BitcoinInterfaceAbi = [
  // ── deposit ──────────────────────────────────────────────────────────────────
  {
    name: 'deposit',
    payable: true,
    inputs: [
      { name: 'questId',      type: ABIDataTypes.STRING  },
      { name: 'minAmountSat', type: ABIDataTypes.UINT256 },
    ],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── withdraw ─────────────────────────────────────────────────────────────────
  {
    name: 'withdraw',
    inputs: [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── getDepositBalance ─────────────────────────────────────────────────────────
  {
    name: 'getDepositBalance',
    constant: true,
    inputs: [
      { name: 'questId', type: ABIDataTypes.STRING  },
      { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── hasDeposited ─────────────────────────────────────────────────────────────
  {
    name: 'hasDeposited',
    constant: true,
    inputs: [
      { name: 'questId', type: ABIDataTypes.STRING  },
      { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'deposited', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  } as const,

  // ── getTotalDeposited ─────────────────────────────────────────────────────────
  {
    name: 'getTotalDeposited',
    constant: true,
    inputs: [{ name: 'questId', type: ABIDataTypes.STRING }],
    outputs: [{ name: 'total', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  } as const,

  ...OP_NET_ABI,
] as BitcoinInterfaceAbi;
