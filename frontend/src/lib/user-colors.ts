const PALETTE = [
  { border: 'border-blue-500/35', bg: 'bg-blue-500/12', text: 'text-blue-200', dot: 'bg-blue-400' },
  { border: 'border-emerald-500/35', bg: 'bg-emerald-500/12', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  { border: 'border-amber-500/35', bg: 'bg-amber-500/12', text: 'text-amber-200', dot: 'bg-amber-400' },
  { border: 'border-rose-500/35', bg: 'bg-rose-500/12', text: 'text-rose-200', dot: 'bg-rose-400' },
  { border: 'border-purple-500/35', bg: 'bg-purple-500/12', text: 'text-purple-200', dot: 'bg-purple-400' },
  { border: 'border-cyan-500/35', bg: 'bg-cyan-500/12', text: 'text-cyan-200', dot: 'bg-cyan-400' },
  { border: 'border-orange-500/35', bg: 'bg-orange-500/12', text: 'text-orange-200', dot: 'bg-orange-400' },
  { border: 'border-pink-500/35', bg: 'bg-pink-500/12', text: 'text-pink-200', dot: 'bg-pink-400' },
  { border: 'border-teal-500/35', bg: 'bg-teal-500/12', text: 'text-teal-200', dot: 'bg-teal-400' },
  { border: 'border-indigo-500/35', bg: 'bg-indigo-500/12', text: 'text-indigo-200', dot: 'bg-indigo-400' },
  { border: 'border-lime-500/35', bg: 'bg-lime-500/12', text: 'text-lime-200', dot: 'bg-lime-400' },
  { border: 'border-fuchsia-500/35', bg: 'bg-fuchsia-500/12', text: 'text-fuchsia-200', dot: 'bg-fuchsia-400' },
];

function stableIndex(userId: string, orderedIds?: string[]) {
  if (orderedIds?.length) {
    const idx = orderedIds.indexOf(userId);
    if (idx >= 0) return idx;
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export type UserColorStyle = {
  border: string;
  bg: string;
  text: string;
  dot: string;
  className: string;
};

export function getUserColor(userId?: string, orderedUserIds?: string[]): UserColorStyle {
  if (!userId) {
    const fallback = PALETTE[0];
    return { ...fallback, className: `${fallback.border} ${fallback.bg} ${fallback.text}` };
  }
  const color = PALETTE[stableIndex(userId, orderedUserIds) % PALETTE.length];
  return { ...color, className: `${color.border} ${color.bg} ${color.text}` };
}

export function buildUserColorLegend(users: Array<{ _id: string; name: string }>) {
  const ids = users.map(u => u._id);
  return users.map(user => ({
    userId: user._id,
    name: user.name,
    color: getUserColor(user._id, ids),
  }));
}
