import { getCreatorColor, getCreatorInitial } from '../utils/creators';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  createdBy: string;
  name: string;
  avatarUrl?: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({
  createdBy,
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: AvatarProps) {
  const sizeClass = `creator-avatar--${size}`;
  const base = `creator-avatar ${sizeClass} ${className}`.trim();

  if (avatarUrl) {
    return (
      <img
        className={`${base} avatar-img`}
        src={avatarUrl}
        alt={name}
      />
    );
  }

  const color = getCreatorColor(createdBy);
  const initial = getCreatorInitial(name);

  return (
    <div className={base} style={{ background: color }}>
      {initial}
    </div>
  );
}
