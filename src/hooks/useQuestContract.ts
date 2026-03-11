import { useCallback } from 'react';
import { getContract, JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import type { Address } from '@btc-vision/transaction';
import type { AbstractRpcProvider, InteractionTransactionReceipt } from 'opnet';
import {
  QUEST_TRACKER_ADDRESS,
  QUEST_CREATOR_ADDRESS,
  OPNET_TESTNET_RPC,
  QuestTrackerAbi,
} from '../config/contract';

/** Read-only provider — used for view calls when no wallet is connected. */
const readOnlyProvider = new JSONRpcProvider({
  url: OPNET_TESTNET_RPC,
  network: networks.opnetTestnet,
});
import type { Quest } from '../types/quest';
import { QuestType } from '../types/quest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractInstance = any;

export const isContractEnabled = () => QUEST_TRACKER_ADDRESS !== '';

/**
 * Resolve which on-chain contract address to use for a given quest.
 * If the quest has an explicit contractAddress (new quests), use that.
 * Otherwise fall back to the original QUEST_TRACKER_ADDRESS (legacy quests).
 */
function resolveContractAddr(contractAddr: string | undefined): string {
  return contractAddr || QUEST_TRACKER_ADDRESS;
}

type PollResult =
  | { status: 'confirmed' }
  | { status: 'failed'; reason: string }
  | { status: 'timeout' };

async function pollForReceipt(
  provider: AbstractRpcProvider,
  txId: string,
  onProgress: (msg: string) => void,
  intervalMs = 5000,
  maxAttempts = 120, // 120 × 5s = 10 minutes
): Promise<PollResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const receipt = await provider.getTransactionReceipt(txId);
      if (receipt) {
        if (receipt.failed) {
          const reason = receipt.revert ?? 'Contract execution reverted';
          return { status: 'failed', reason };
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
    onProgress(`Transaction pending… (${display})`);
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
    QuestTrackerAbi,
    provider,
    networks.opnetTestnet,
    sender,
  );
}

export function useQuestContract(
  address: Address | null,
  walletAddress: string | null,
  provider: AbstractRpcProvider | null,
) {
  const completeQuestOnChain = useCallback(
    async (
      questId: string,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');
      if (!isContractEnabled()) throw new Error('Contract not configured');

      const contract = makeContract(provider, resolveContractAddr(contractAddr), address);

      // Step 1 — simulate
      onProgress('Simulating…');
      const sim = await contract.completeQuest(questId);

      if (sim && 'error' in sim) throw new Error(String(sim.error));
      if (sim?.revert) throw new Error(`Simulate reverted: ${sim.revert}`);

      // Step 2 — broadcast (OPWallet prompts the user to approve)
      onProgress('Approve in OPWallet…');
      const receipt: InteractionTransactionReceipt = await sim.sendTransaction({
        signer: null,
        mldsaSigner: null,
        refundTo: walletAddress,
        maximumAllowedSatToSpend: 100_000n,
        network: networks.opnetTestnet,
      });

      const { transactionId: txId, peerAcknowledgements } = receipt;
      console.info(`[QuestContract] tx broadcast: ${txId} (peers: ${peerAcknowledgements})`);

      if (!txId) throw new Error('No transaction ID returned — broadcast may have failed.');

      onProgress('Confirming…');

      // Step 3 — poll for block inclusion
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation. Check your wallet for the tx status.');
    },
    [address, walletAddress, provider],
  );

  const getOnChainCount = useCallback(
    async (questId: string, contractAddr?: string): Promise<number | null> => {
      if (!address || !provider || !isContractEnabled()) return null;
      try {
        const contract = makeContract(provider, resolveContractAddr(contractAddr), address);
        const result = await contract.getCompletionCount(questId);
        if (!result) {
          console.warn('[QuestContract] getCompletionCount: no result for', questId);
          return null;
        }
        if ('error' in result) {
          console.warn('[QuestContract] getCompletionCount error for', questId, result.error);
          return null;
        }
        if ('count' in result) return Number(result.count);
        console.warn('[QuestContract] getCompletionCount: unexpected result shape for', questId, result);
        return null;
      } catch (err) {
        console.warn('[QuestContract] getCompletionCount threw for', questId, err);
        return null;
      }
    },
    [address, provider],
  );

  // Checks whether the currently-connected wallet has completed this quest on-chain.
  const isCompletedOnChain = useCallback(
    async (questId: string, contractAddr?: string): Promise<boolean | null> => {
      if (!address || !provider || !isContractEnabled()) return null;
      try {
        const contract = makeContract(provider, resolveContractAddr(contractAddr), address);
        const result = await contract.isCompleted(questId, address);
        if (!result) {
          console.warn('[QuestContract] isCompleted: no result for', questId);
          return null;
        }
        if ('error' in result) {
          console.warn('[QuestContract] isCompleted error for', questId, result.error);
          return null;
        }
        if ('completed' in result) return Boolean(result.completed);
        console.warn('[QuestContract] isCompleted: unexpected result shape for', questId, result);
        return null;
      } catch (err) {
        console.warn('[QuestContract] isCompleted threw for', questId, err);
        return null;
      }
    },
    [address, provider],
  );

  /**
   * Create a quest on-chain with full metadata.
   * All fields are stored in the contract and retrievable by any user.
   */
  const createQuestOnChain = useCallback(
    async (
      questId: string,
      title: string,
      description: string,
      link: string,
      questType: QuestType,
      onProgress: (msg: string) => void = () => {},
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');
      if (!QUEST_CREATOR_ADDRESS) throw new Error('Quest creation not yet available — contract not deployed.');

      const contract = makeContract(provider, QUEST_CREATOR_ADDRESS, address);

      onProgress('Simulating…');
      const sim = await contract.createQuest(questId, title, description, link, questType);

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

      const { transactionId: txId, peerAcknowledgements } = receipt;
      console.info(`[QuestContract] createQuest tx: ${txId} (peers: ${peerAcknowledgements})`);

      if (!txId) throw new Error('No transaction ID returned — broadcast may have failed.');

      onProgress('Confirming…');
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation. Check your wallet for the tx status.');
    },
    [address, walletAddress, provider],
  );

  /**
   * Update a quest's mutable metadata on-chain.
   * Only succeeds when the caller is the original creator.
   */
  const updateQuestOnChain = useCallback(
    async (
      questId: string,
      title: string,
      description: string,
      link: string,
      questType: QuestType,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');

      const contract = makeContract(provider, resolveContractAddr(contractAddr), address);

      onProgress('Simulating…');
      const sim = await contract.updateQuestMetadata(questId, title, description, link, questType);

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
      if (!txId) throw new Error('No transaction ID returned.');

      onProgress('Confirming…');
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation.');
    },
    [address, walletAddress, provider],
  );

  /**
   * Soft-delete a quest on-chain.
   * Only succeeds when the caller is the original creator.
   */
  const deleteQuestOnChain = useCallback(
    async (
      questId: string,
      onProgress: (msg: string) => void = () => {},
      contractAddr?: string,
    ): Promise<{ txId: string }> => {
      if (!address || !walletAddress || !provider) throw new Error('Wallet not connected');

      const contract = makeContract(provider, resolveContractAddr(contractAddr), address);

      onProgress('Simulating…');
      const sim = await contract.deleteQuest(questId);

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
      if (!txId) throw new Error('No transaction ID returned.');

      onProgress('Confirming…');
      const result = await pollForReceipt(provider, txId, onProgress);

      if (result.status === 'confirmed') return { txId };
      if (result.status === 'failed') throw new Error(`On-chain error: ${result.reason}`);
      throw new Error('Timed out waiting for confirmation.');
    },
    [address, walletAddress, provider],
  );

  /**
   * Fetch all quests stored on-chain from the QUEST_CREATOR_ADDRESS contract.
   * Returns an empty array if the contract is not configured or the call fails.
   */
  const fetchQuestsFromChain = useCallback(
    async (): Promise<Quest[]> => {
      if (!QUEST_CREATOR_ADDRESS) return [];
      // Use the wallet's provider when connected, otherwise fall back to the
      // read-only provider — so quests load for every visitor, wallet or not.
      const rpcProvider = provider ?? readOnlyProvider;
      try {
        const contract = makeContract(rpcProvider, QUEST_CREATOR_ADDRESS);

        // Get total quest count
        const countResult = await contract.getQuestCount();
        if (!countResult || 'error' in countResult) {
          console.warn('[QuestContract] getQuestCount failed:', countResult);
          return [];
        }
        const count = Number(countResult.count);
        if (count === 0) return [];

        // Fetch each quest by sequential index
        const fetched: Quest[] = [];
        for (let i = 0; i < count; i++) {
          try {
            const r = await contract.getQuestAt(i);
            if (!r || 'error' in r) {
              console.warn('[QuestContract] getQuestAt failed for index', i, r);
              continue;
            }
            fetched.push({
              id: String(r.questId),
              title: String(r.title),
              description: String(r.description),
              link: String(r.link),
              questType: Number(r.questType) as QuestType,
              // Convert the on-chain Address to the OPNet bech32 string (opt1s…)
              // so it matches walletAddress from useWalletConnect.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              createdBy: (() => { try { return (r.creator as any).p2op(networks.opnetTestnet) as string; } catch { return String(r.creator); } })(),
              createdAt: Number(r.createdAt), // block number used as ordering key
              txId: undefined,
              contractAddress: QUEST_CREATOR_ADDRESS,
            });
          } catch (err) {
            console.warn('[QuestContract] getQuestAt threw for index', i, err);
          }
        }
        return fetched;
      } catch (err) {
        console.warn('[QuestContract] fetchQuestsFromChain failed:', err);
        return [];
      }
    },
    [address, provider],
  );

  return {
    completeQuestOnChain,
    createQuestOnChain,
    updateQuestOnChain,
    deleteQuestOnChain,
    fetchQuestsFromChain,
    getOnChainCount,
    isCompletedOnChain,
  };
}
