export const ADMIN_ADDRESS =
  'opt1pqpvhg5gyh28j9lfyknqx7g5rmrrpjyya9mm759ugzp764vl3kmfqx8ncuv';

export function isAdminWallet(walletAddress: string | null): boolean {
  if (!walletAddress) return false;
  return walletAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
}
