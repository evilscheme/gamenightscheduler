export const AVATAR_PALETTE_SIZE = 16;

export const AVATAR_CLASSES = [
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
  'bg-avatar-6',
  'bg-avatar-7',
  'bg-avatar-8',
  'bg-avatar-9',
  'bg-avatar-10',
  'bg-avatar-11',
  'bg-avatar-12',
  'bg-avatar-13',
  'bg-avatar-14',
  'bg-avatar-15',
  'bg-avatar-16',
] as const;

// FNV-1a 32-bit hash — better distribution across UUID-like inputs than djb2,
// and the palette size is a power of two so the modulo doesn't bias the spread.
export function getAvatarColorClass(userId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const idx = (hash >>> 0) % AVATAR_CLASSES.length;
  return AVATAR_CLASSES[idx];
}

export function getInitial(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return ([...trimmed][0] || '?').toUpperCase();
}
