export type LeadOption = { _id: string; schoolName: string; zone?: string };

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compactSchoolName(value: string) {
  return normalizeSearchText(value).replace(/^โรงเรียน/, '').replace(/^รร\.?/, '').replace(/\s+/g, '');
}

export function rankLeadMatch(lead: LeadOption, query: string) {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const name = normalizeSearchText(lead.schoolName || '');
  const compactName = compactSchoolName(lead.schoolName || '');
  const compactQuery = compactSchoolName(query);
  const zone = normalizeSearchText(lead.zone || '');
  const haystack = `${name} ${zone}`.trim();

  if (name === q || (compactQuery && compactName === compactQuery)) return 1000;
  if (name.startsWith(q) || (compactQuery && compactName.startsWith(compactQuery))) return 800;
  if (zone.startsWith(q)) return 750;

  const nameWords = name.split(' ');
  if (nameWords.some(word => word.startsWith(q))) return 650;

  if (name.includes(q) || (compactQuery && compactName.includes(compactQuery))) return 500;
  if (zone.includes(q)) return 400;
  if (haystack.includes(q)) return 300;

  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every(token => haystack.includes(token))) {
    return 200 + tokens.length * 20;
  }

  return 0;
}

export function filterLeadsBySearch(leads: LeadOption[], query: string, limit = 30) {
  const q = normalizeSearchText(query);

  if (!q) {
    return [...leads]
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'th'))
      .slice(0, 50);
  }

  return leads
    .map(lead => ({ lead, score: rankLeadMatch(lead, q) }))
    .filter(item => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.lead.schoolName.localeCompare(b.lead.schoolName, 'th');
    })
    .slice(0, limit)
    .map(item => item.lead);
}
