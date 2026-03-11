import { Blockchain } from '@btc-vision/btc-runtime/runtime';
import { StakingQuest } from './contracts/StakingQuest';
import { revertOnError } from '@btc-vision/btc-runtime/runtime/abort/abort';

// Factory function — required by OPNet runtime
Blockchain.contract = (): StakingQuest => {
    return new StakingQuest();
};

// Runtime exports — required
export * from '@btc-vision/btc-runtime/runtime/exports';

// Abort handler — required
export function abort(message: string, fileName: string, line: u32, column: u32): void {
    revertOnError(message, fileName, line, column);
}
