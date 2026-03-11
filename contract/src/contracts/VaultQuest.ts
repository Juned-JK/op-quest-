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
import { DepositedEvent } from '../events/DepositedEvent';
import { VaultWithdrawnEvent } from '../events/VaultWithdrawnEvent';

/**
 * VaultQuest — on-chain vault deposit contract for OP Quest.
 *
 * Users deposit tBTC (as a BTC output to this contract's P2OP address)
 * to complete a vault quest. The hasDeposited flag is permanent (persists
 * after withdrawal) so quest completion is preserved even if the user
 * withdraws their deposit.
 *
 * P2OP output format: OP_16 (0x60) PUSH21 (0x15) [deploymentVersion:1][hash160:20]
 */
@final
export class VaultQuest extends OP_NET {
    // ── Storage pointers — NEVER reorder ─────────────────────────────────────
    // depositKey(questId, wallet) → current deposit amount in satoshis (u256)
    private readonly depositsPointer: u16 = Blockchain.nextPointer;
    // depositKey(questId, wallet) → 1 if ever deposited (permanent, survives withdrawal)
    private readonly hasDepositedPointer: u16 = Blockchain.nextPointer;
    // questKey(questId) → total satoshis deposited across all wallets for this quest
    private readonly totalDepositedPointer: u16 = Blockchain.nextPointer;

    // ── Storage maps ──────────────────────────────────────────────────────────
    private readonly deposits: StoredMapU256 = new StoredMapU256(this.depositsPointer);
    private readonly hasDepositedMap: StoredMapU256 = new StoredMapU256(this.hasDepositedPointer);
    private readonly totalDeposited: StoredMapU256 = new StoredMapU256(this.totalDepositedPointer);

    public constructor() {
        super();
    }

    // ── Deposit ────────────────────────────────────────────────────────────────

    /**
     * Deposit tBTC into the vault to complete a quest.
     *
     * The transaction MUST include a BTC output to this contract's P2OP address
     * with at least `minAmountSat` satoshis. The contract reads Blockchain.tx.outputs
     * and sums all P2OP outputs (OP_16 scripts) as the deposited amount.
     *
     * A wallet can only deposit once per quest. The `hasDeposited` flag is set permanently.
     *
     * @payable — mark the ABI as payable; include a BTC output to this contract
     */
    @method(
        { name: 'questId',      type: ABIDataTypes.STRING  },
        { name: 'minAmountSat', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('Deposited')
    public deposit(calldata: Calldata): BytesWriter {
        const questId: string     = calldata.readStringWithLength();
        const minAmountSat: u256  = calldata.readU256();

        const caller: Address = Blockchain.tx.sender;
        const depositKey      = this.depositKey(questId, caller);

        // Each wallet can only deposit once per quest
        if (this.hasDepositedMap.get(depositKey) != u256.Zero) {
            throw new Revert('Already deposited for this quest');
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
                'Insufficient deposit: attach a BTC output to this vault contract address',
            );
        }

        // Record the deposit balance and permanent completion flag
        this.deposits.set(depositKey, depositAmount);
        this.hasDepositedMap.set(depositKey, u256.One);

        // Update quest-level total
        const questKey     = this.questKey(questId);
        const currentTotal = this.totalDeposited.get(questKey);
        this.totalDeposited.set(questKey, SafeMath.add(currentTotal, depositAmount));

        this.emitEvent(new DepositedEvent(caller, questKey, depositAmount));

        const result = new BytesWriter(1);
        result.writeBoolean(true);
        return result;
    }

    /**
     * Withdraw the caller's active deposit for a quest.
     *
     * Clears the deposit balance and emits a VaultWithdrawnEvent.
     * The `hasDeposited` flag remains true so the quest stays completed.
     *
     * The actual tBTC is returned to the caller by the OPNet protocol
     * via its UTXO release mechanism when this withdrawal is confirmed.
     */
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('VaultWithdrawn')
    public withdraw(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const caller: Address = Blockchain.tx.sender;
        const depositKey      = this.depositKey(questId, caller);

        const amount = this.deposits.get(depositKey);
        if (amount == u256.Zero) {
            throw new Revert('No active deposit to withdraw');
        }

        // Clear balance (keeps hasDeposited=1 for permanent completion record)
        this.deposits.set(depositKey, u256.Zero);

        // Reduce quest-level total
        const questKey     = this.questKey(questId);
        const currentTotal = this.totalDeposited.get(questKey);
        this.totalDeposited.set(questKey, SafeMath.sub(currentTotal, amount));

        this.emitEvent(new VaultWithdrawnEvent(caller, questKey, amount));

        const result = new BytesWriter(32);
        result.writeU256(amount);
        return result;
    }

    // ── View methods ──────────────────────────────────────────────────────────

    /**
     * Current deposit balance for a wallet on a specific quest.
     * Returns 0 if the wallet has not deposited or has already withdrawn.
     */
    @view
    @method(
        { name: 'questId', type: ABIDataTypes.STRING  },
        { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public getDepositBalance(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const wallet: Address = calldata.readAddress();

        const key    = this.depositKey(questId, wallet);
        const amount = this.deposits.get(key);

        const result = new BytesWriter(32);
        result.writeU256(amount);
        return result;
    }

    /**
     * Returns true if the wallet has EVER deposited for this quest,
     * even if they have since withdrawn. Used for quest completion check.
     */
    @view
    @method(
        { name: 'questId', type: ABIDataTypes.STRING  },
        { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'deposited', type: ABIDataTypes.BOOL })
    public hasDeposited(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const wallet: Address = calldata.readAddress();

        const key = this.depositKey(questId, wallet);

        const result = new BytesWriter(1);
        result.writeBoolean(this.hasDepositedMap.get(key) != u256.Zero);
        return result;
    }

    /**
     * Total satoshis currently deposited across all wallets for a quest.
     */
    @view
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'total', type: ABIDataTypes.UINT256 })
    public getTotalDeposited(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const questKey        = this.questKey(questId);
        const total           = this.totalDeposited.get(questKey);

        const result = new BytesWriter(32);
        result.writeU256(total);
        return result;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Composite storage key: sha256(questId_bytes || wallet_bytes).
     * Unique per (quest, wallet) pair.
     */
    private depositKey(questId: string, wallet: Address): u256 {
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
