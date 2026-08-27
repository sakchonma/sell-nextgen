export const SALES_FUNNEL_STAGES = [
  { code: 'TargetSchool', label: 'Target School', labelTh: 'Target School' },
  { code: 'Called', label: 'Called', labelTh: 'Call แล้ว' },
  { code: 'DocumentSent', label: 'Document Sent', labelTh: 'ส่งเอกสารแล้ว' },
  { code: 'Appointed', label: 'Appointed', labelTh: 'นัดหมายแล้ว' },
  { code: 'Presented', label: 'Presented', labelTh: 'Present แล้ว' },
  { code: 'DemoWorkshop', label: 'Demo/Workshop', labelTh: 'Demo/Workshop แล้ว' },
  { code: 'Quotation', label: 'Quotation', labelTh: 'Quotation' },
  { code: 'Won', label: 'Won', labelTh: 'Won' },
  { code: 'Lost', label: 'Lost', labelTh: 'Lost' },
] as const;

export type SalesFunnelStage = (typeof SALES_FUNNEL_STAGES)[number]['code'];

export const SALES_FUNNEL_STAGE_CODES = SALES_FUNNEL_STAGES.map(row => row.code);

export const FUNNEL_DISPLAY_STAGE_CODES = [
  'Called',
  'DocumentSent',
  'Appointed',
  'Presented',
  'DemoWorkshop',
  'Quotation',
  'Won',
  'Lost',
] as const;

export const SALES_FUNNEL_STAGE_OPTIONS = SALES_FUNNEL_STAGES.map(row => ({
  value: row.code,
  label: row.labelTh,
}));

export const DOCUMENT_CHANNEL_OPTIONS = [
  { value: 'Email', label: 'Email' },
  { value: 'SchoolSubmit', label: 'ยื่นรร.' },
] as const;

export const APPOINTMENT_KIND_OPTIONS = [
  { value: 'Present', label: 'ไป Present' },
  { value: 'DemoWorkshop', label: 'ไป Demo/Workshop' },
] as const;

export function getSalesFunnelStageLabel(code?: string) {
  const found = SALES_FUNNEL_STAGES.find(row => String(row.code) === String(code || ''));
  return found?.labelTh || found?.label || code || 'Target School';
}

export function getSalesFunnelStageStyle(stage: string) {
  if (stage === 'Won') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (stage === 'Lost') return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
  if (stage === 'Quotation') return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
  if (stage === 'DemoWorkshop') return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
  if (stage === 'Presented') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
  if (stage === 'Appointed') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
  if (stage === 'DocumentSent') return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
  if (stage === 'Called') return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
  if (stage === 'TargetSchool') return 'bg-slate-800 text-slate-300 border-slate-700';
  return 'bg-slate-800 text-slate-400 border-slate-700';
}

export function getPipelineColumnStyle(stage: string) {
  if (stage === 'Won') return 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5';
  if (stage === 'Lost') return 'border-rose-500/20 text-rose-400 bg-rose-500/5';
  if (stage === 'Quotation') return 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5';
  if (stage === 'DemoWorkshop') return 'border-purple-500/20 text-purple-400 bg-purple-500/5';
  if (stage === 'Presented') return 'border-cyan-500/20 text-cyan-400 bg-cyan-500/5';
  if (stage === 'Appointed') return 'border-amber-500/20 text-amber-400 bg-amber-500/5';
  if (stage === 'DocumentSent') return 'border-sky-500/20 text-sky-400 bg-sky-500/5';
  if (stage === 'Called') return 'border-blue-500/20 text-blue-400 bg-blue-500/5';
  if (stage === 'TargetSchool') return 'border-slate-500/20 text-slate-400 bg-slate-500/5';
  return 'border-slate-500/20 text-slate-400 bg-slate-500/5';
}

const LEGACY_LEAD_STAGE_MAP: Record<string, SalesFunnelStage> = {
  'New Lead': 'TargetSchool',
  Contacted: 'Called',
  Interested: 'Appointed',
  'Demo Scheduled': 'DemoWorkshop',
  'Proposal Sent': 'Quotation',
  'Pilot/Trial': 'Quotation',
  'Closed Won': 'Won',
  'Closed Lost': 'Lost',
  Call: 'Called',
  Meeting: 'Appointed',
  Presentation: 'Presented',
  นัดหมาย: 'Appointed',
  Pending: 'Called',
  Present: 'Presented',
};

export function normalizeLeadStage(value: unknown): SalesFunnelStage {
  if (typeof value !== 'string' || !value.trim()) return 'TargetSchool';
  if ((SALES_FUNNEL_STAGE_CODES as readonly string[]).includes(value)) return value as SalesFunnelStage;
  return LEGACY_LEAD_STAGE_MAP[value] || 'TargetSchool';
}

export function stageRequiresEventAt(stage: string) {
  return stage === 'Appointed' || stage === 'Presented' || stage === 'DemoWorkshop';
}

export function getStageEventAtLabel(stage: string) {
  const normalized = normalizeLeadStage(stage);
  if (normalized === 'Appointed') return 'วันที่ที่จะไปพบ';
  if (normalized === 'Presented') return 'วันที่ที่พรีเซนต์เรียบร้อยแล้ว';
  if (normalized === 'DemoWorkshop') return 'วันที่ Demo/Workshop';
  return 'วันเวลานัด';
}

export function formatThaiDate(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH');
}

export function temperatureFromStage(stage: string): 'Cold' | 'Warm' | 'Hot' | 'Customer' {
  const normalized = normalizeLeadStage(stage);
  if (normalized === 'Presented') return 'Warm';
  if (normalized === 'DemoWorkshop') return 'Hot';
  if (normalized === 'Quotation' || normalized === 'Won') return 'Customer';
  return 'Cold';
}

export function resolveLeadPipelineValue(
  leadId: string,
  stage: SalesFunnelStage,
  opportunities: Array<{ leadId?: string; stage?: string; value?: number }>,
  quotes: Array<{ leadId?: string; status?: string; totalAmount?: number; createdAt?: string | Date }>,
) {
  const opp = opportunities.find(item => item.leadId === leadId);
  const leadQuotes = quotes
    .filter(quote => quote.leadId === leadId)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  if (stage === 'Quotation') {
    const latestQuote = leadQuotes[0];
    if (latestQuote?.totalAmount != null) return Number(latestQuote.totalAmount) || 0;
  }

  if (stage === 'Won') {
    if (normalizeLeadStage(opp?.stage) === 'Won' && opp?.value != null) return Number(opp.value) || 0;
    const approvedQuote = leadQuotes.find(quote => quote.status === 'Approved');
    if (approvedQuote?.totalAmount != null) return Number(approvedQuote.totalAmount) || 0;
  }

  if (opp?.value != null) return Number(opp.value) || 0;
  if (leadQuotes[0]?.totalAmount != null) return Number(leadQuotes[0].totalAmount) || 0;
  return 0;
}
