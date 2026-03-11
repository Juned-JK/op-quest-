import { useCallback } from 'react';
import { getContract, JSONRpcProvider, TransactionOutputFlags } from 'opnet';
import { networks, payments } from '@btc-vision/bitcoin';
import type { Address } from '@btc-vision/transaction';
import type { AbstractRpcProvider, InteractionTransactionReceipt } from 'opnet';
import {
  STAKING_QUEST_ADDRESS,
  OPNET_TESTNET_RPC,
  StakingQuestAbi,
  DEFAULT_MIN_STAKE_SATS,
} from '../config/stakingContract';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractInstance = any;

/** Read-only provider for view calls when no wallet is connected. */
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
    StakingQuestAbi,
    provider,
    networks.opnetTestnet,
    sender,
  );
}

function resolveAddr(contractAddr?: string): string | null {
  return contractAddr || STAKING_QUEST_ADDRESS || null;
}

export function useStakingQuest(
  address: Address | null,
  walletAddress: string | null,
  provider: AbstractRpcProvider | null,
) {
  /**
   * Stake tBTC to complete a quest.
   *
   * Uses setTransactionDetails so the contract can see the BTC output during
   * simulation, then sends with extraOutputs matching that amount.
   */
  const stakeForQuest = useCallback(
    async (
      questId: string,
      stakeAmountSats: bigint,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');
      const addr = resolveAddr(contractAddr);
      if (!addr) throw new Error('Staking contract not deployed yet');

      const contract = makeContract(provider, addr, address);

      // Tell the contract what BTC output to expect during simulation.
      // Index 0 is reserved — staking output starts at index 1.
      // inputs: [] is required — the library calls inputs.map() internally.
      // Derive the raw P2OP scriptPubKey so the simulation engine can match it
      // against Blockchain.tx.outputs[].scriptPublicKey inside the contract.
      // hasTo + OPNet address does NOT produce the correct [0x60, 0x15, ...] bytes.
      const p2opScript = payments.p2op({ address: addr, network: networks.opnetTestnet }).output;
      if (!p2opScript) throw new Error(`Cannot derive P2OP script for address: ${addr}`);

      contract.setTransactionDetails({
        inputs: [],
        outputs: [
          {
            to: addr,
            value: stakeAmountSats,
            index: 1,
            scriptPubKey: p2opScript,
            flags: TransactionOutputFlags.hasScriptPubKey,
          },
        ],
      });

      onProgress('Simulating…');
      const sim = await contract.stake(questId, stakeAmountSats);

      if (sim && 'error' in sim) throw new Error(String(sim.error));
      if (sim?.revert) throw new Error(`Simulate reverted: ${sim.revert}`);

      onProgress('Approve in OPWallet…');
      const receipt: InteractionTransactionReceipt = await sim.sendTransaction({
        signer: null,         // FRONTEND — wallet handles signing
        mldsaSigner: null,
        refundTo: walletAddress,
        // Must cover stake amount + gas fees
        maximumAllowedSatToSpend: stakeAmountSats + 100_000n,
        network: networks.opnetTestnet,
        // Use raw P2OP script so the wallet builds the correct output bytes
        // that the contract sees in Blockchain.tx.outputs
        extraOutputs: [
          {
            script: p2opScript,
            value: stakeAmountSats,
          },
        ],
      });

      const { transactionId: txId } = receipt;
      if (!txId) throw new Error('No transaction ID returned — broadcast may have failed.');

      onProgress('Confirming stake…');
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation. Check your wallet for tx status.');
    },
    [address, walletAddress, provider],
  );

  /**
   * Withdraw a previously staked amount.
   *
   * The staking contract emits a WithdrawnEvent and the OPNet protocol
   * returns the tBTC UTXO to the caller's wallet.
   */
  const withdrawStake = useCallback(
    async (
      questId: string,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');
      const addr = resolveAddr(contractAddr);
      if (!addr) throw new Error('Staking contract not deployed yet');

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
      throw new Error('Timed out waiting for confirmation. Check your wallet for tx status.');
    },
    [address, walletAddress, provider],
  );

  /** Current stake balance for the connected wallet on a specific quest (satoshis). */
  const getStakeBalance = useCallback(
    async (questId: string, contractAddr?: string): Promise<bigint | null> => {
      if (!address) return null;
      const addr = resolveAddr(contractAddr);
      if (!addr) return null;
      try {
        const rpcProvider = provider ?? readOnlyProvider;
        const contract    = makeContract(rpcProvider, addr, address);
        const result      = await contract.getStakeBalance(questId, address);
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
   * Whether the connected wallet has EVER staked for a quest
   * (true even after withdrawal — permanent completion marker).
   */
  const checkHasStaked = useCallback(
    async (questId: string, contractAddr?: string): Promise<boolean | null> => {
      if (!address) return null;
      const addr = resolveAddr(contractAddr);
      if (!addr) return null;
      try {
        const rpcProvider = provider ?? readOnlyProvider;
        const contract    = makeContract(rpcProvider, addr, address);
        const result      = await contract.hasStaked(questId, address);
        if (!result || 'error' in result) return null;
        if ('staked' in result) return Boolean(result.staked);
        return null;
      } catch {
        return null;
      }
    },
    [address, provider],
  );

  return {
    stakeForQuest,
    withdrawStake,
    getStakeBalance,
    checkHasStaked,
    defaultMinStake: DEFAULT_MIN_STAKE_SATS,
  };
}
