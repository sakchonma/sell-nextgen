export const SALES_FUNNEL_STAGE_CODES = [
  'Call',
  'Meeting',
  'Presentation',
  'DemoWorkshop',
  'Quotation',
  'Won',
  'Lost',
] as const;

export type SalesFunnelStage = (typeof SALES_FUNNEL_STAGE_CODES)[number];

export const SALES_FUNNEL_STAGES: Array<{
  code: SalesFunnelStage;
  label: string;
  labelTh: string;
}> = [
  { code: 'Call', label: 'Call', labelTh: 'Call' },
  { code: 'Meeting', label: 'Meeting', labelTh: 'นัดหมาย' },
  { code: 'Presentation', label: 'Presentation', labelTh: 'Presentation' },
  { code: 'DemoWorkshop', label: 'Demo/Workshop', labelTh: 'Demo/Workshop' },
  { code: 'Quotation', label: 'Quotation', labelTh: 'Quotation' },
  { code: 'Won', label: 'Won', labelTh: 'Won' },
  { code: 'Lost', label: 'Lost', labelTh: 'Lost' },
];

const LEGACY_LEAD_STAGE_MAP: Record<string, SalesFunnelStage> = {
  'New Lead': 'Call',
  Contacted: 'Call',
  Interested: 'Meeting',
  'Demo Scheduled': 'DemoWorkshop',
  'Proposal Sent': 'Quotation',
  'Pilot/Trial': 'Quotation',
  'Closed Won': 'Won',
  'Closed Lost': 'Lost',
};

const LEGACY_OPPORTUNITY_STAGE_MAP: Record<string, SalesFunnelStage> = {
  Qualified: 'Call',
  Presentation: 'Presentation',
  Demo: 'DemoWorkshop',
  Proposal: 'Quotation',
  Negotiation: 'Quotation',
  Won: 'Won',
  Lost: 'Lost',
};

export function isSalesFunnelStage(value: unknown): value is SalesFunnelStage {
  return typeof value === 'string' && (SALES_FUNNEL_STAGE_CODES as readonly string[]).includes(value);
}

export function normalizeLeadStage(value: unknown): SalesFunnelStage {
  if (typeof value !== 'string' || !value.trim()) return 'Call';
  if (isSalesFunnelStage(value)) return value;
  return LEGACY_LEAD_STAGE_MAP[value] || 'Call';
}

export function normalizeOpportunityStage(value: unknown): SalesFunnelStage {
  if (typeof value !== 'string' || !value.trim()) return 'Call';
  if (isSalesFunnelStage(value)) return value;
  return LEGACY_OPPORTUNITY_STAGE_MAP[value] || 'Call';
}

export function defaultProbabilityForStage(stage: string): number {
  const normalized = normalizeOpportunityStage(stage);
  if (normalized === 'Call') return 10;
  if (normalized === 'Meeting') return 20;
  if (normalized === 'Presentation') return 35;
  if (normalized === 'DemoWorkshop') return 55;
  if (normalized === 'Quotation') return 75;
  if (normalized === 'Won') return 100;
  if (normalized === 'Lost') return 0;
  return 20;
}

export function salesFunnelStageIndex(stage: SalesFunnelStage): number {
  return SALES_FUNNEL_STAGE_CODES.indexOf(stage);
}

export function getStageLabel(stage: SalesFunnelStage, useThai = false): string {
  const found = SALES_FUNNEL_STAGES.find(row => row.code === stage);
  if (!found) return stage;
  return useThai ? found.labelTh : found.label;
}

export const salesFunnelStageSchemaValues = [...SALES_FUNNEL_STAGE_CODES] as [SalesFunnelStage, ...SalesFunnelStage[]];
