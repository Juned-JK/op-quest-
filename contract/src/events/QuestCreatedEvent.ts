import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class QuestCreatedEvent extends NetEvent {
    constructor(creator: Address, questIdHash: u256) {
        // 32 bytes creator address + 32 bytes questIdHash
        const data = new BytesWriter(64);
        data.writeAddress(creator);
        data.writeU256(questIdHash);
        super('QuestCreated', data);
    }
}
