import { useCallback } from 'react';
import { getContract, JSONRpcProvider, TransactionOutputFlags } from 'opnet';
import { networks, payments } from '@btc-vision/bitcoin';
import type { Address } from '@btc-vision/transaction';
import type { AbstractRpcProvider, InteractionTransactionReceipt } from 'opnet';
import {
  VAULT_QUEST_ADDRESS,
  OPNET_TESTNET_RPC,
  VaultQuestAbi,
  DEFAULT_MIN_DEPOSIT_SATS,
} from '../config/vaultContract';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractInstance = any;

const readOnlyProvider = new JSONRpcProvider({
  url: OPNET_TESTNET_RPC,
  network: networks.opnetTestnet,
});

type PollResult =
  | { status: 'confirmed' }
  | { status: 'failed'; reason: string }
  | { status: 'timeout' };

async function pollForReceipt(
  provider: AbstractRpcProvider,
  txId: string,
  onProgress: (msg: string) => void,
  intervalMs = 5000,
  maxAttempts = 120,
): Promise<PollResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const receipt = await provider.getTransactionReceipt(txId);
      if (receipt) {
        if (receipt.failed) {
          return { status: 'failed', reason: receipt.revert ?? 'Contract execution reverted' };
        }
        return { status: 'confirmed' };
      }
    } catch {
      // tx not yet indexed — keep polling
    }
    const elapsedSec = (i + 1) * (intervalMs / 1000);
    const display =
      elapsedSec >= 60
        ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
        : `${elapsedSec}s`;
    onProgress(`Confirming… (${display})`);
  }
  return { status: 'timeout' };
}

function makeContract(
  provider: AbstractRpcProvider,
  contractAddr: string,
  sender?: Address,
): ContractInstance {
  return getContract<ContractInstance>(
    contractAddr,
    VaultQuestAbi,
    provider,
    networks.opnetTestnet,
    sender,
  );
}

function resolveAddr(contractAddr?: string): string | null {
  return contractAddr || VAULT_QUEST_ADDRESS || null;
}

export function useVaultQuest(
  address: Address | null,
  walletAddress: string | null,
  provider: AbstractRpcProvider | null,
) {
  /**
   * Deposit tBTC into the vault to complete a quest.
   */
  const depositForQuest = useCallback(
    async (
      questId: string,
      depositAmountSats: bigint,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');
      const addr = resolveAddr(contractAddr);
      if (!addr) throw new Error('Vault contract not deployed yet');

      const contract = makeContract(provider, addr, address);

      // Derive raw P2OP scriptPubKey for the simulation engine
      const p2opScript = payments.p2op({ address: addr, network: networks.opnetTestnet }).output;
      if (!p2opScript) throw new Error(`Cannot derive P2OP script for address: ${addr}`);

      contract.setTransactionDetails({
        inputs: [],
        outputs: [
          {
            to: addr,
            value: depositAmountSats,
            index: 1,
            scriptPubKey: p2opScript,
            flags: TransactionOutputFlags.hasScriptPubKey,
          },
        ],
      });

      onProgress('Simulating deposit…');
      const sim = await contract.deposit(questId, depositAmountSats);

      if (sim && 'error' in sim) throw new Error(String(sim.error));
      if (sim?.revert) throw new Error(`Simulate reverted: ${sim.revert}`);

      onProgress('Approve in OPWallet…');
      const receipt: InteractionTransactionReceipt = await sim.sendTransaction({
        signer: null,
        mldsaSigner: null,
        refundTo: walletAddress,
        maximumAllowedSatToSpend: depositAmountSats + 100_000n,
        network: networks.opnetTestnet,
        extraOutputs: [
          {
            script: p2opScript,
            value: depositAmountSats,
          },
        ],
      });

      const { transactionId: txId } = receipt;
      if (!txId) throw new Error('No transaction ID returned — broadcast may have failed.');

      onProgress('Confirming deposit…');
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation. Check your wallet for tx status.');
    },
    [address, walletAddress, provider],
  );

  /**
   * Withdraw a previously deposited amount from the vault.
   */
  const withdrawDeposit = useCallback(
    async (
      questId: string,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');
      const addr = resolveAddr(contractAddr);
      if (!addr) throw new Error('Vault contract not deployed yet');

      const contract = makeContract(provider, addr, address);

      onProgress('Simulating withdrawal…');
      const sim = await contract.withdraw(questId);

      if (sim && 'error' in sim) throw new Error(String(sim.error));
      if (sim?.revert) throw new Error(`Simulate reverted: ${sim.revert}`);

      onProgress('Approve in OPWallet…');
      const receipt: InteractionTransactionReceipt = await sim.sendTransaction({
        signer: null,
        mldsaSigner: null,
        refundTo: walletAddress,
        maximumAllowedSatToSpend: 100_000n,
        network: networks.opnetTestnet,
      });

      const { transactionId: txId } = receipt;
      if (!txId) throw new Error('No transaction ID returned — broadcast may have failed.');

      onProgress('Confirming withdrawal…');
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation.');
    },
    [address, walletAddress, provider],
  );

  /** Current deposit balance for this wallet on a quest (satoshis). */
  const getDepositBalance = useCallback(
    async (questId: string, contractAddr?: string): Promise<bigint | null> => {
      if (!address) return null;
      const addr = resolveAddr(contractAddr);
      if (!addr) return null;
      try {
        const rpcProvider = provider ?? readOnlyProvider;
        const contract    = makeContract(rpcProvider, addr, address);
        const result      = await contract.getDepositBalance(questId, address);
        if (!result || 'error' in result) return null;
        if ('amount' in result) return BigInt(result.amount.toString());
        return null;
      } catch {
        return null;
      }
    },
    [address, provider],
  );

  /**
   * Whether this wallet has EVER deposited for a quest
   * (permanent completion marker, survives withdrawal).
   */
  const checkHasDeposited = useCallback(
    async (questId: string, contractAddr?: string): Promise<boolean | null> => {
      if (!address) return null;
      const addr = resolveAddr(contractAddr);
      if (!addr) return null;
      try {
        const rpcProvider = provider ?? readOnlyProvider;
        const contract    = makeContract(rpcProvider, addr, address);
        const result      = await contract.hasDeposited(questId, address);
        if (!result || 'error' in result) return null;
        if ('deposited' in result) return Boolean(result.deposited);
        return null;
      } catch {
        return null;
      }
    },
    [address, provider],
  );

  return {
    depositForQuest,
    withdrawDeposit,
    getDepositBalance,
    checkHasDeposited,
    defaultMinDeposit: DEFAULT_MIN_DEPOSIT_SATS,
  };
}
