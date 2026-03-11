import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Revert,
    SafeMath,
    Segwit,
    StoredMapU256,
} from '@btc-vision/btc-runtime/runtime';
import { StakedEvent } from '../events/StakedEvent';
import { WithdrawnEvent } from '../events/WithdrawnEvent';

/**
 * StakingQuest — on-chain staking contract for OP Quest.
 *
 * Users stake tBTC (as a BTC output to this contract's P2OP address)
 * to complete a quest. The hasStaked flag is permanent (persists after
 * withdrawal) so quest completion is preserved even if the user withdraws.
 *
 * P2OP output format: OP_16 (0x60) PUSH21 (0x15) [deploymentVersion:1][hash160:20]
 * The contract verifies outputs in Blockchain.tx.outputs matching this pattern.
 */
@final
export class StakingQuest extends OP_NET {
    // ── Storage pointers — NEVER reorder ─────────────────────────────────────
    // stakeKey(questId, wallet) → current stake amount in satoshis (u256)
    private readonly stakesPointer: u16 = Blockchain.nextPointer;
    // stakeKey(questId, wallet) → 1 if ever staked (permanent, survives withdrawal)
    private readonly hasStakedPointer: u16 = Blockchain.nextPointer;
    // questKey(questId) → total satoshis staked across all wallets for this quest
    private readonly totalStakedPointer: u16 = Blockchain.nextPointer;

    // ── Storage maps ──────────────────────────────────────────────────────────
    private readonly stakes: StoredMapU256 = new StoredMapU256(this.stakesPointer);
    private readonly hasStakedMap: StoredMapU256 = new StoredMapU256(this.hasStakedPointer);
    private readonly totalStaked: StoredMapU256 = new StoredMapU256(this.totalStakedPointer);

    public constructor() {
        super();
    }

    // ── Staking ────────────────────────────────────────────────────────────────

    /**
     * Stake tBTC to complete a quest.
     *
     * The transaction MUST include a BTC output to this contract's P2OP address
     * with at least `minAmountSat` satoshis. The contract reads Blockchain.tx.outputs
     * and sums all P2OP outputs (OP_16 scripts) as the deposited amount.
     *
     * A wallet can only stake once per quest. The `hasStaked` flag is set permanently.
     *
     * @payable — mark the ABI as payable; include a BTC output to this contract
     */
    @method(
        { name: 'questId',      type: ABIDataTypes.STRING  },
        { name: 'minAmountSat', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('Staked')
    public stake(calldata: Calldata): BytesWriter {
        const questId: string     = calldata.readStringWithLength();
        const minAmountSat: u256  = calldata.readU256();

        const caller: Address = Blockchain.tx.sender;
        const stakeKey        = this.stakeKey(questId, caller);

        // Each wallet can only stake once per quest
        if (this.hasStakedMap.get(stakeKey) != u256.Zero) {
            throw new Revert('Already staked for this quest');
        }

        // Sum satoshis from all P2OP outputs in this transaction.
        // The OPNet node may encode P2OP outputs in two ways:
        //   1. hasScriptPubKey — raw script bytes  (simulation / old nodes)
        //   2. hasTo           — bech32 address string (on-chain / new nodes)
        // We handle both so the check works in simulation AND on-chain.
        const outputs = Blockchain.tx.outputs;
        let depositSat: u64 = 0;
        for (let i = 0; i < outputs.length; i++) {
            const output = outputs[i];
            const script = output.scriptPublicKey;
            if (script !== null && this.isP2OPScript(script)) {
                depositSat += output.value;
            } else if (output.to !== null && this.isP2OPAddress(output.to as string)) {
                depositSat += output.value;
            }
        }

        const depositAmount: u256 = u256.fromU64(depositSat);

        if (u256.lt(depositAmount, minAmountSat)) {
            throw new Revert(
                'Insufficient stake: attach a BTC output to this contract address',
            );
        }

        // Record the stake balance and permanent completion flag
        this.stakes.set(stakeKey, depositAmount);
        this.hasStakedMap.set(stakeKey, u256.One);

        // Update quest-level total
        const questKey      = this.questKey(questId);
        const currentTotal  = this.totalStaked.get(questKey);
        this.totalStaked.set(questKey, SafeMath.add(currentTotal, depositAmount));

        this.emitEvent(new StakedEvent(caller, questKey, depositAmount));

        const result = new BytesWriter(1);
        result.writeBoolean(true);
        return result;
    }

    /**
     * Withdraw the caller's active stake for a quest.
     *
     * Clears the stake balance and emits a WithdrawnEvent.
     * The `hasStaked` flag remains true so the quest stays completed.
     *
     * The actual tBTC is returned to the caller by the OPNet protocol
     * via its UTXO release mechanism when this withdrawal is confirmed.
     */
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('Withdrawn')
    public withdraw(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const caller: Address = Blockchain.tx.sender;
        const stakeKey        = this.stakeKey(questId, caller);

        const amount = this.stakes.get(stakeKey);
        if (amount == u256.Zero) {
            throw new Revert('No active stake to withdraw');
        }

        // Clear balance (keeps hasStaked=1 for permanent completion record)
        this.stakes.set(stakeKey, u256.Zero);

        // Reduce quest-level total
        const questKey     = this.questKey(questId);
        const currentTotal = this.totalStaked.get(questKey);
        this.totalStaked.set(questKey, SafeMath.sub(currentTotal, amount));

        this.emitEvent(new WithdrawnEvent(caller, questKey, amount));

        const result = new BytesWriter(32);
        result.writeU256(amount);
        return result;
    }

    // ── View methods ──────────────────────────────────────────────────────────

    /**
     * Current stake balance for a wallet on a specific quest.
     * Returns 0 if the wallet has not staked or has already withdrawn.
     */
    @view
    @method(
        { name: 'questId', type: ABIDataTypes.STRING  },
        { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public getStakeBalance(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const wallet: Address = calldata.readAddress();

        const key    = this.stakeKey(questId, wallet);
        const amount = this.stakes.get(key);

        const result = new BytesWriter(32);
        result.writeU256(amount);
        return result;
    }

    /**
     * Returns true if the wallet has EVER staked for this quest,
     * even if they have since withdrawn. Used for quest completion check.
     */
    @view
    @method(
        { name: 'questId', type: ABIDataTypes.STRING  },
        { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'staked', type: ABIDataTypes.BOOL })
    public hasStaked(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const wallet: Address = calldata.readAddress();

        const key = this.stakeKey(questId, wallet);

        const result = new BytesWriter(1);
        result.writeBoolean(this.hasStakedMap.get(key) != u256.Zero);
        return result;
    }

    /**
     * Total satoshis currently staked across all wallets for a quest.
     */
    @view
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'total', type: ABIDataTypes.UINT256 })
    public getTotalStaked(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const questKey        = this.questKey(questId);
        const total           = this.totalStaked.get(questKey);

        const result = new BytesWriter(32);
        result.writeU256(total);
        return result;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Composite storage key: sha256(questId_bytes || wallet_bytes).
     * Unique per (quest, wallet) pair.
     */
    private stakeKey(questId: string, wallet: Address): u256 {
        const questBytes = Uint8Array.wrap(String.UTF8.encode(questId));
        const combined   = new Uint8Array(questBytes.length + 32);
        combined.set(questBytes, 0);
        combined.set(wallet, questBytes.length);
        return u256.fromBytes(Blockchain.sha256(combined));
    }

    /**
     * Quest-level storage key: sha256(questId_bytes).
     */
    private questKey(questId: string): u256 {
        const questBytes = Uint8Array.wrap(String.UTF8.encode(questId));
        return u256.fromBytes(Blockchain.sha256(questBytes));
    }

    /**
     * Returns true for a P2OP (Pay-to-OPNet) output script.
     * P2OP script structure:
     *   OP_16 (0x60)  — SegWit version 16
     *   PUSH21 (0x15) — push 21 bytes
     *   [1 byte deploymentVersion][20 bytes hash160]
     * Total length: 23 bytes
     */
    private isP2OPScript(script: Uint8Array): bool {
        return script.length == 23 && script[0] == 0x60 && script[1] == 0x15;
    }

    /**
     * Returns true when a bech32 address string represents a P2OP output.
     * Used when the node encodes outputs with the hasTo flag (address string)
     * instead of hasScriptPubKey (raw script bytes).
     * P2OP = witness version 16, 21-byte program.
     */
    private isP2OPAddress(addr: string): bool {
        const decoded = Segwit.decodeOrNull(addr);
        if (!decoded) return false;
        return decoded.version == 16 && decoded.program.length == 21;
    }
}
