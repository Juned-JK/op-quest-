const AVATAR_COLORS = [
  '#f7931a', // bitcoin orange
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export function resolveCreatorName(
  createdBy: string,
  getDisplayNameFor: (addr: string) => string,
  creatorNameSnapshot?: string,
): string {
  if (createdBy === 'system') return 'OPNet Team';
  const live = getDisplayNameFor(createdBy);
  if (live) return live;
  if (creatorNameSnapshot) return creatorNameSnapshot;
  return `${createdBy.slice(0, 6)}…${createdBy.slice(-4)}`;
}

export function getCreatorColor(createdBy: string): string {
  if (createdBy === 'system') return '#f7931a';
  let hash = 0;
  for (let i = 0; i < createdBy.length; i++) {
    hash = createdBy.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getCreatorInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
