import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class QuestCompletedEvent extends NetEvent {
    constructor(wallet: Address, questIdHash: u256) {
        // 32 bytes for address + 32 bytes for questIdHash = 64 bytes
        const data = new BytesWriter(64);
        data.writeAddress(wallet);
        data.writeU256(questIdHash);
        super('QuestCompleted', data);
    }
}
