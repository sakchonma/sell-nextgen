const PALETTE = [
  { border: 'border-blue-500', bg: 'bg-blue-200', text: 'text-slate-900', dot: 'bg-blue-500' },
  { border: 'border-emerald-500', bg: 'bg-emerald-200', text: 'text-slate-900', dot: 'bg-emerald-500' },
  { border: 'border-amber-500', bg: 'bg-amber-200', text: 'text-slate-900', dot: 'bg-amber-500' },
  { border: 'border-rose-500', bg: 'bg-rose-200', text: 'text-slate-900', dot: 'bg-rose-500' },
  { border: 'border-purple-500', bg: 'bg-purple-200', text: 'text-slate-900', dot: 'bg-purple-500' },
  { border: 'border-cyan-500', bg: 'bg-cyan-200', text: 'text-slate-900', dot: 'bg-cyan-500' },
  { border: 'border-orange-500', bg: 'bg-orange-200', text: 'text-slate-900', dot: 'bg-orange-500' },
  { border: 'border-pink-500', bg: 'bg-pink-200', text: 'text-slate-900', dot: 'bg-pink-500' },
  { border: 'border-teal-500', bg: 'bg-teal-200', text: 'text-slate-900', dot: 'bg-teal-500' },
  { border: 'border-indigo-500', bg: 'bg-indigo-200', text: 'text-slate-900', dot: 'bg-indigo-500' },
  { border: 'border-lime-600', bg: 'bg-lime-200', text: 'text-slate-900', dot: 'bg-lime-600' },
  { border: 'border-fuchsia-500', bg: 'bg-fuchsia-200', text: 'text-slate-900', dot: 'bg-fuchsia-500' },
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
