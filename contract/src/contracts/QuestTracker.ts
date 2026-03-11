import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Revert,
    SafeMath,
    StoredMapU256,
    StoredString,
} from '@btc-vision/btc-runtime/runtime';
import { QuestCompletedEvent } from '../events/QuestCompletedEvent';
import { QuestCreatedEvent } from '../events/QuestCreatedEvent';

@final
export class QuestTracker extends OP_NET {
    // ── Existing pointers — NEVER reorder ────────────────────────────────────
    private readonly completionsPointer: u16 = Blockchain.nextPointer;
    private readonly countsPointer: u16 = Blockchain.nextPointer;
    private readonly questsPointer: u16 = Blockchain.nextPointer;

    // ── New pointers — append only, never reorder ──────────────────────────
    private readonly questCountPointer: u16 = Blockchain.nextPointer;   // total registered quest count
    private readonly questIdStrPointer: u16 = Blockchain.nextPointer;   // sequential index → questId string
    private readonly questTitlePointer: u16 = Blockchain.nextPointer;   // sequential index → title
    private readonly questDescPointer: u16 = Blockchain.nextPointer;    // sequential index → description
    private readonly questLinkPointer: u16 = Blockchain.nextPointer;    // sequential index → link
    private readonly questTypePointer: u16 = Blockchain.nextPointer;    // questIdHash → questType (u256)
    private readonly questCreatorPointer: u16 = Blockchain.nextPointer; // questIdHash → creator (as u256)
    private readonly questCreatedAtPointer: u16 = Blockchain.nextPointer; // questIdHash → block number

    // ── Edit / delete pointers — append only ─────────────────────────────
    private readonly questIndexPointer: u16 = Blockchain.nextPointer;   // questIdHash → idx+1 (0 = not set)
    private readonly questDeletedPointer: u16 = Blockchain.nextPointer; // questIdHash → 1 if deleted

    // ── Storage maps ───────────────────────────────────────────────────────
    private readonly completions: StoredMapU256 = new StoredMapU256(this.completionsPointer);
    private readonly counts: StoredMapU256 = new StoredMapU256(this.countsPointer);
    private readonly quests: StoredMapU256 = new StoredMapU256(this.questsPointer);
    private readonly questCountMap: StoredMapU256 = new StoredMapU256(this.questCountPointer);
    private readonly questTypeMap: StoredMapU256 = new StoredMapU256(this.questTypePointer);
    private readonly questCreatorMap: StoredMapU256 = new StoredMapU256(this.questCreatorPointer);
    private readonly questCreatedAtMap: StoredMapU256 = new StoredMapU256(this.questCreatedAtPointer);
    private readonly questIndexMap: StoredMapU256 = new StoredMapU256(this.questIndexPointer);
    private readonly questDeletedMap: StoredMapU256 = new StoredMapU256(this.questDeletedPointer);

    public constructor() {
        super();
    }

    // ─── Quest creation ───────────────────────────────────────────────────────

    /**
     * Register a new quest on-chain with full metadata.
     * Stores questId, title, description, link, questType, creator, and block number.
     * Reverts if this questId has already been registered.
     */
    @method(
        { name: 'questId', type: ABIDataTypes.STRING },
        { name: 'title', type: ABIDataTypes.STRING },
        { name: 'description', type: ABIDataTypes.STRING },
        { name: 'link', type: ABIDataTypes.STRING },
        { name: 'questType', type: ABIDataTypes.UINT8 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('QuestCreated')
    public createQuest(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const title: string = calldata.readStringWithLength();
        const description: string = calldata.readStringWithLength();
        const link: string = calldata.readStringWithLength();
        const questType: u8 = calldata.readU8();

        const creator: Address = Blockchain.tx.sender;
        const idKey = this.questKey(questId);

        if (this.quests.get(idKey) != u256.Zero) {
            throw new Revert('Quest already registered');
        }

        // Mark as registered
        this.quests.set(idKey, u256.One);

        // Determine sequential index for this quest
        const count: u256 = this.questCountMap.get(u256.Zero);
        const idx: u64 = count.toU64();

        // Store all string fields at this sequential index
        const storedId = new StoredString(this.questIdStrPointer, idx);
        storedId.value = questId;

        const storedTitle = new StoredString(this.questTitlePointer, idx);
        storedTitle.value = title;

        const storedDesc = new StoredString(this.questDescPointer, idx);
        storedDesc.value = description;

        const storedLink = new StoredString(this.questLinkPointer, idx);
        storedLink.value = link;

        // Store metadata keyed by questIdHash
        this.questTypeMap.set(idKey, u256.fromU64(u64(questType)));
        this.questCreatorMap.set(idKey, u256.fromUint8ArrayBE(creator));
        this.questCreatedAtMap.set(idKey, u256.fromU64(Blockchain.block.number));

        // Store reverse index lookup (1-indexed so 0 means "not set")
        this.questIndexMap.set(idKey, SafeMath.add(count, u256.One));

        // Increment global quest count
        this.questCountMap.set(u256.Zero, SafeMath.add(count, u256.One));

        this.emitEvent(new QuestCreatedEvent(creator, idKey));

        const result = new BytesWriter(1);
        result.writeBoolean(true);
        return result;
    }

    /**
     * Update a quest's mutable metadata (title, description, link, questType).
     * Only callable by the original creator. Reverts if deleted.
     */
    @method(
        { name: 'questId',     type: ABIDataTypes.STRING },
        { name: 'title',       type: ABIDataTypes.STRING },
        { name: 'description', type: ABIDataTypes.STRING },
        { name: 'link',        type: ABIDataTypes.STRING },
        { name: 'questType',   type: ABIDataTypes.UINT8  },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public updateQuestMetadata(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const title: string = calldata.readStringWithLength();
        const description: string = calldata.readStringWithLength();
        const link: string = calldata.readStringWithLength();
        const questType: u8 = calldata.readU8();

        const caller: Address = Blockchain.tx.sender;
        const idKey = this.questKey(questId);

        if (this.quests.get(idKey) == u256.Zero) {
            throw new Revert('Quest not found');
        }

        if (this.questDeletedMap.get(idKey) != u256.Zero) {
            throw new Revert('Quest already deleted');
        }

        const callerU256 = u256.fromUint8ArrayBE(caller);
        if (this.questCreatorMap.get(idKey) != callerU256) {
            throw new Revert('Not the creator');
        }

        // Look up the sequential index (stored as idx+1)
        const idxPlusOne = this.questIndexMap.get(idKey);
        if (idxPlusOne == u256.Zero) {
            throw new Revert('Quest index not found');
        }
        const idx: u64 = idxPlusOne.toU64() - 1;

        // Update stored string fields
        const storedTitle = new StoredString(this.questTitlePointer, idx);
        storedTitle.value = title;

        const storedDesc = new StoredString(this.questDescPointer, idx);
        storedDesc.value = description;

        const storedLink = new StoredString(this.questLinkPointer, idx);
        storedLink.value = link;

        // Update quest type
        this.questTypeMap.set(idKey, u256.fromU64(u64(questType)));

        const result = new BytesWriter(1);
        result.writeBoolean(true);
        return result;
    }

    /**
     * Soft-delete a quest. Only callable by the original creator.
     * Deleted quests are skipped by getQuestAt.
     */
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public deleteQuest(calldata: Calldata): BytesWriter {
        const questId: string = calldata.readStringWithLength();
        const caller: Address = Blockchain.tx.sender;
        const idKey = this.questKey(questId);

        if (this.quests.get(idKey) == u256.Zero) {
            throw new Revert('Quest not found');
        }

        if (this.questDeletedMap.get(idKey) != u256.Zero) {
            throw new Revert('Quest already deleted');
        }

        const callerU256 = u256.fromUint8ArrayBE(caller);
        if (this.questCreatorMap.get(idKey) != callerU256) {
            throw new Revert('Not the creator');
        }

        this.questDeletedMap.set(idKey, u256.One);

        const result = new BytesWriter(1);
        result.writeBoolean(true);
        return result;
    }

    /**
     * Check whether a quest ID has been registered on-chain.
     */
    @view
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'registered', type: ABIDataTypes.BOOL })
    public isRegistered(calldata: Calldata): BytesWriter {
        const questId = calldata.readStringWithLength();
        const idKey = this.questKey(questId);

        const result = new BytesWriter(1);
        result.writeBoolean(this.quests.get(idKey) != u256.Zero);
        return result;
    }

    /**
     * Returns the total number of registered quests (including deleted ones).
     */
    @view
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public getQuestCount(calldata: Calldata): BytesWriter {
        const count = this.questCountMap.get(u256.Zero);
        const result = new BytesWriter(32);
        result.writeU256(count);
        return result;
    }

    /**
     * Returns full metadata for the quest at the given sequential index.
     * Reverts with 'Deleted' if the quest has been soft-deleted (frontend skips it).
     * Reverts with 'Index out of range' if the index exceeds total count.
     */
    @view
    @method({ name: 'index', type: ABIDataTypes.UINT32 })
    @returns(
        { name: 'questId',     type: ABIDataTypes.STRING  },
        { name: 'title',       type: ABIDataTypes.STRING  },
        { name: 'description', type: ABIDataTypes.STRING  },
        { name: 'link',        type: ABIDataTypes.STRING  },
        { name: 'questType',   type: ABIDataTypes.UINT8   },
        { name: 'creator',     type: ABIDataTypes.ADDRESS },
        { name: 'createdAt',   type: ABIDataTypes.UINT256 },
    )
    public getQuestAt(calldata: Calldata): BytesWriter {
        const index: u32 = calldata.readU32();
        const count: u256 = this.questCountMap.get(u256.Zero);

        if (u256.fromU64(u64(index)) >= count) {
            throw new Revert('Index out of range');
        }

        const idx: u64 = u64(index);

        // Load stored strings
        const storedId = new StoredString(this.questIdStrPointer, idx);
        const questId: string = storedId.value;

        // Check if soft-deleted (frontend try/catch will skip this index)
        const idKey = this.questKey(questId);
        if (this.questDeletedMap.get(idKey) != u256.Zero) {
            throw new Revert('Deleted');
        }

        const storedTitle = new StoredString(this.questTitlePointer, idx);
        const title: string = storedTitle.value;

        const storedDesc = new StoredString(this.questDescPointer, idx);
        const description: string = storedDesc.value;

        const storedLink = new StoredString(this.questLinkPointer, idx);
        const link: string = storedLink.value;

        // Load metadata by questIdHash
        const questType: u8 = u8(this.questTypeMap.get(idKey).toU64());
        const creator: Address = Address.fromUint8Array(this.questCreatorMap.get(idKey).toUint8Array(true));
        const createdAt: u256 = this.questCreatedAtMap.get(idKey);

        // Calculate buffer size dynamically
        const questIdBytes = String.UTF8.encode(questId);
        const titleBytes = String.UTF8.encode(title);
        const descBytes = String.UTF8.encode(description);
        const linkBytes = String.UTF8.encode(link);

        const bufSize: i32 =
            4 + questIdBytes.byteLength +  // questId: u32 length + bytes
            4 + titleBytes.byteLength +    // title
            4 + descBytes.byteLength +     // description
            4 + linkBytes.byteLength +     // link
            1 +                            // questType (u8)
            32 +                           // creator (Address = 32 bytes)
            32;                            // createdAt (u256 = 32 bytes)

        const result = new BytesWriter(bufSize);
        result.writeStringWithLength(questId);
        result.writeStringWithLength(title);
        result.writeStringWithLength(description);
        result.writeStringWithLength(link);
        result.writeU8(questType);
        result.writeAddress(creator);
        result.writeU256(createdAt);
        return result;
    }

    // ─── Quest completion ─────────────────────────────────────────────────────

    /**
     * Mark the caller as having completed a quest.
     * Reverts if the caller has already completed it.
     */
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('QuestCompleted')
    public completeQuest(calldata: Calldata): BytesWriter {
        const questId = calldata.readStringWithLength();
        const caller: Address = Blockchain.tx.sender;

        const compKey = this.completionKey(questId, caller);
        if (this.completions.get(compKey) != u256.Zero) {
            throw new Revert('Already completed');
        }

        this.completions.set(compKey, u256.One);

        const countKey = this.questKey(questId);
        const currentCount = this.counts.get(countKey);
        this.counts.set(countKey, SafeMath.add(currentCount, u256.One));

        this.emitEvent(new QuestCompletedEvent(caller, countKey));

        const result = new BytesWriter(1);
        result.writeBoolean(true);
        return result;
    }

    /**
     * Check whether a specific wallet has completed a quest.
     */
    @view
    @method(
        { name: 'questId', type: ABIDataTypes.STRING },
        { name: 'wallet',  type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'completed', type: ABIDataTypes.BOOL })
    public isCompleted(calldata: Calldata): BytesWriter {
        const questId = calldata.readStringWithLength();
        const wallet: Address = calldata.readAddress();

        const key = this.completionKey(questId, wallet);
        const val = this.completions.get(key);

        const result = new BytesWriter(1);
        result.writeBoolean(val != u256.Zero);
        return result;
    }

    /**
     * Get the total number of completions for a quest.
     */
    @view
    @method({ name: 'questId', type: ABIDataTypes.STRING })
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public getCompletionCount(calldata: Calldata): BytesWriter {
        const questId = calldata.readStringWithLength();
        const key = this.questKey(questId);
        const count = this.counts.get(key);

        const result = new BytesWriter(32);
        result.writeU256(count);
        return result;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private completionKey(questId: string, wallet: Address): u256 {
        const questBytes = Uint8Array.wrap(String.UTF8.encode(questId));
        const combined = new Uint8Array(questBytes.length + 32);
        combined.set(questBytes, 0);
        combined.set(wallet, questBytes.length);
        return u256.fromBytes(Blockchain.sha256(combined));
    }

    private questKey(questId: string): u256 {
        const questBytes = Uint8Array.wrap(String.UTF8.encode(questId));
        return u256.fromBytes(Blockchain.sha256(questBytes));
    }
}
