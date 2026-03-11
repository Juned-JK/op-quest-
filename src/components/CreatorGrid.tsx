import { CreatorBox } from './CreatorBox';
import { resolveCreatorName } from '../utils/creators';
import type { Quest } from '../types/quest';

interface CreatorGridProps {
  quests: Quest[];
  getDisplayNameFor: (addr: string) => string;
  getAvatarFor: (addr: string) => string;
}

interface CreatorEntry {
  createdBy: string;
  name: string;
  questCount: number;
}

export function CreatorGrid({ quests, getDisplayNameFor, getAvatarFor }: CreatorGridProps) {
  // Group quests by creator
  const map = new Map<string, Quest[]>();
  for (const quest of quests) {
    const group = map.get(quest.createdBy) ?? [];
    group.push(quest);
    map.set(quest.createdBy, group);
  }

  if (map.size === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">📋</span>
        <p>No quests yet. Be the first to create one!</p>
      </div>
    );
  }

  const creators: CreatorEntry[] = Array.from(map.entries()).map(([createdBy, group]) => ({
    createdBy,
    name: resolveCreatorName(createdBy, getDisplayNameFor, group[0]?.creatorName),
    questCount: group.length,
  }));

  // OPNet Team first, then rest alphabetically
  creators.sort((a, b) => {
    if (a.createdBy === 'system') return -1;
    if (b.createdBy === 'system') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="creator-grid-section">
      <div className="quest-list-header">
        <h2 className="section-title">Quest Creators</h2>
        <span className="stat">
          <span className="stat-value">{creators.length}</span>{' '}
          {creators.length === 1 ? 'creator' : 'creators'}
        </span>
      </div>
      <div className="creator-grid">
        {creators.map(({ createdBy, name, questCount }) => (
          <CreatorBox
            key={createdBy}
            createdBy={createdBy}
            name={name}
            questCount={questCount}
            avatarUrl={getAvatarFor(createdBy) || undefined}
          />
        ))}
      </div>
    </div>
  );
}
