const PALETTE = [
  { border: 'border-blue-400/80', bg: 'bg-blue-600/45', text: 'text-white', dot: 'bg-blue-400' },
  { border: 'border-emerald-400/80', bg: 'bg-emerald-600/45', text: 'text-white', dot: 'bg-emerald-400' },
  { border: 'border-amber-400/80', bg: 'bg-amber-600/50', text: 'text-white', dot: 'bg-amber-400' },
  { border: 'border-rose-400/80', bg: 'bg-rose-600/45', text: 'text-white', dot: 'bg-rose-400' },
  { border: 'border-purple-400/80', bg: 'bg-purple-600/45', text: 'text-white', dot: 'bg-purple-400' },
  { border: 'border-cyan-400/80', bg: 'bg-cyan-600/45', text: 'text-white', dot: 'bg-cyan-400' },
  { border: 'border-orange-400/80', bg: 'bg-orange-600/50', text: 'text-white', dot: 'bg-orange-400' },
  { border: 'border-pink-400/80', bg: 'bg-pink-600/45', text: 'text-white', dot: 'bg-pink-400' },
  { border: 'border-teal-400/80', bg: 'bg-teal-600/45', text: 'text-white', dot: 'bg-teal-400' },
  { border: 'border-indigo-400/80', bg: 'bg-indigo-600/45', text: 'text-white', dot: 'bg-indigo-400' },
  { border: 'border-lime-400/80', bg: 'bg-lime-700/50', text: 'text-white', dot: 'bg-lime-400' },
  { border: 'border-fuchsia-400/80', bg: 'bg-fuchsia-600/45', text: 'text-white', dot: 'bg-fuchsia-400' },
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
