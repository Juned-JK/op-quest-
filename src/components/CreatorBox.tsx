import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';

interface CreatorBoxProps {
  createdBy: string;
  name: string;
  questCount: number;
  avatarUrl?: string;
}

export function CreatorBox({ createdBy, name, questCount, avatarUrl }: CreatorBoxProps) {
  return (
    <Link to={`/creator/${createdBy}`} className="creator-box">
      <Avatar createdBy={createdBy} name={name} avatarUrl={avatarUrl} size="md" />
      <p className="creator-box-name">{name}</p>
      <p className="creator-box-count">
        {questCount} {questCount === 1 ? 'quest' : 'quests'}
      </p>
    </Link>
  );
}
