import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class VaultWithdrawnEvent extends NetEvent {
    constructor(wallet: Address, questIdHash: u256, amount: u256) {
        // 32 bytes (address) + 32 bytes (questIdHash) + 32 bytes (amount) = 96 bytes
        const data = new BytesWriter(96);
        data.writeAddress(wallet);
        data.writeU256(questIdHash);
        data.writeU256(amount);
        super('VaultWithdrawn', data);
    }
}
