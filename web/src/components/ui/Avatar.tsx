interface AvatarProps {
  avatarUrl?: string | null;
  name: string; // displayName || username || email — first letter is the fallback
  size?: number;
  className?: string;
}

/** A profile picture, or an initials circle when no avatar is set. */
export function Avatar({ avatarUrl, name, size = 40, className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`avatar-circle${className ? ` ${className}` : ""}`}
        style={style}
      />
    );
  }

  return (
    <div className={`avatar-circle avatar-initial${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      {initial}
    </div>
  );
}
