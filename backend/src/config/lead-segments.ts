/**
 * Lead segments: one `leads` collection serves three customer groups.
 *
 * - school      → เมนู "Leads & โรงเรียน" (ข้อมูลเดิมที่ไม่มี segment ถือเป็น school)
 * - corporate   → เมนู "Leads องค์กร"
 * - university  → เมนู "Leads มหาวิทยาลัย"
 *
 * ทุก segment ใช้ _id ของ lead ตัวเดียวกันกับ Opportunity / Task / Quote / Request / AI Log
 * จึงเชื่อมกับระบบเดิมได้ทันทีโดยไม่ต้องสร้าง collection ใหม่
 */
export const LEAD_SEGMENTS = ['school', 'corporate', 'university'] as const;
export type LeadSegment = (typeof LEAD_SEGMENTS)[number];

export function normalizeLeadSegment(value: unknown): LeadSegment {
  return LEAD_SEGMENTS.includes(value as LeadSegment) ? (value as LeadSegment) : 'school';
}

/** `undefined` / 'All' / unknown → null (no segment filter). */
export function parseSegmentFilter(value: unknown): LeadSegment | null {
  if (typeof value !== 'string' || !value || value === 'All' || value === 'all') return null;
  return LEAD_SEGMENTS.includes(value as LeadSegment) ? (value as LeadSegment) : null;
}

/**
 * segmentProfile fields that the list pages can filter on (query `pf.<key>=value`)
 * and that /api/leads/segment-facets returns counts for.
 */
export const SEGMENT_FILTER_FIELDS: Record<LeadSegment, string[]> = {
  school: [],
  corporate: ['region', 'orgType', 'tier', 'serviceOffer', 'eventStatus2569', 'recommendedRound', 'directProjectEvidence', 'isTop20', 'followerRole'],
  university: ['institutionType', 'university', 'tier', 'contactStatus', 'newBudgetStatus', 'startFirst'],
};

/** segmentProfile fields included in free-text search. */
export const SEGMENT_SEARCH_FIELDS: Record<LeadSegment, string[]> = {
  school: [],
  corporate: ['code', 'orgType', 'serviceOffer', 'budgetGroup', 'targetRole'],
  university: ['facultyCode', 'university', 'faculty', 'meetingArea', 'targetRole'],
};

export function profileValueKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** Returns false when a lead fails any `pf.<key>` filter for the given segment. */
export function matchesProfileFilters(
  lead: { segment?: unknown; segmentProfile?: Record<string, unknown> },
  segment: LeadSegment | null,
  filters: Record<string, string>
): boolean {
  if (!segment) return true;
  const allowed = SEGMENT_FILTER_FIELDS[segment];
  const profile = lead.segmentProfile || {};
  for (const [key, expected] of Object.entries(filters)) {
    if (!allowed.includes(key) || !expected || expected === 'All') continue;
    if (profileValueKey(profile[key]) !== expected) return false;
  }
  return true;
}

/** Pull `pf.<key>` query params out of an Express query object. */
export function extractProfileFilters(query: Record<string, unknown>): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(query)) {
    if (!rawKey.startsWith('pf.')) continue;
    const key = rawKey.slice(3);
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (key && text) filters[key] = text;
  }
  return filters;
}

export function buildSegmentFacets(
  leads: Array<{ segmentProfile?: Record<string, unknown> }>,
  segment: LeadSegment
) {
  const facets: Record<string, Array<{ value: string; count: number }>> = {};
  for (const field of SEGMENT_FILTER_FIELDS[segment]) {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = profileValueKey(lead.segmentProfile?.[field]);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    facets[field] = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'th'));
  }
  return facets;
}
