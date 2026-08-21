export const SALES_FUNNEL_STAGE_CODES = [
  'TargetSchool',
  'Called',
  'DocumentSent',
  'Appointed',
  'Presented',
  'DemoWorkshop',
  'Quotation',
  'Won',
  'Lost',
] as const;

export type SalesFunnelStage = (typeof SALES_FUNNEL_STAGE_CODES)[number];

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

export const SALES_FUNNEL_STAGES: Array<{
  code: SalesFunnelStage;
  label: string;
  labelTh: string;
}> = [
  { code: 'TargetSchool', label: 'Target School', labelTh: 'Target School' },
  { code: 'Called', label: 'Called', labelTh: 'Call แล้ว' },
  { code: 'DocumentSent', label: 'Document Sent', labelTh: 'ส่งเอกสารแล้ว' },
  { code: 'Appointed', label: 'Appointed', labelTh: 'นัดหมายแล้ว' },
  { code: 'Presented', label: 'Presented', labelTh: 'Present แล้ว' },
  { code: 'DemoWorkshop', label: 'Demo/Workshop', labelTh: 'Demo/Workshop แล้ว' },
  { code: 'Quotation', label: 'Quotation', labelTh: 'Quotation' },
  { code: 'Won', label: 'Won', labelTh: 'Won' },
  { code: 'Lost', label: 'Lost', labelTh: 'Lost' },
];

export const DOCUMENT_CHANNEL_CODES = ['Email', 'SchoolSubmit'] as const;
export type DocumentChannel = (typeof DOCUMENT_CHANNEL_CODES)[number];

export const APPOINTMENT_KIND_CODES = ['Present', 'DemoWorkshop'] as const;
export type AppointmentKind = (typeof APPOINTMENT_KIND_CODES)[number];

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
  'Call แล้ว': 'Called',
  'ส่งเอกสารแล้ว': 'DocumentSent',
  'นัดหมายแล้ว': 'Appointed',
  'Present แล้ว': 'Presented',
  'Demo/Workshop แล้ว': 'DemoWorkshop',
  'Target School': 'TargetSchool',
};

const LEGACY_OPPORTUNITY_STAGE_MAP: Record<string, SalesFunnelStage> = {
  Qualified: 'Called',
  Call: 'Called',
  Meeting: 'Appointed',
  Presentation: 'Presented',
  Demo: 'DemoWorkshop',
  DemoWorkshop: 'DemoWorkshop',
  Proposal: 'Quotation',
  Negotiation: 'Quotation',
  Won: 'Won',
  Lost: 'Lost',
};

export function isSalesFunnelStage(value: unknown): value is SalesFunnelStage {
  return typeof value === 'string' && (SALES_FUNNEL_STAGE_CODES as readonly string[]).includes(value);
}

export function normalizeLeadStage(value: unknown): SalesFunnelStage {
  if (typeof value !== 'string' || !value.trim()) return 'TargetSchool';
  if (isSalesFunnelStage(value)) return value;
  return LEGACY_LEAD_STAGE_MAP[value] || 'TargetSchool';
}

export function normalizeOpportunityStage(value: unknown): SalesFunnelStage {
  if (typeof value !== 'string' || !value.trim()) return 'TargetSchool';
  if (isSalesFunnelStage(value)) return value;
  return LEGACY_OPPORTUNITY_STAGE_MAP[value] || LEGACY_LEAD_STAGE_MAP[value] || 'TargetSchool';
}

export function temperatureFromStage(stage: SalesFunnelStage): 'Cold' | 'Warm' | 'Hot' | 'Customer' {
  switch (stage) {
    case 'DocumentSent':
    case 'TargetSchool':
    case 'Called':
    case 'Appointed':
    case 'Lost':
      return 'Cold';
    case 'Presented':
      return 'Warm';
    case 'DemoWorkshop':
      return 'Hot';
    case 'Quotation':
    case 'Won':
      return 'Customer';
    default: {
      const _never: never = stage;
      return _never;
    }
  }
}

export function defaultProbabilityForStage(stage: string): number {
  const normalized = normalizeOpportunityStage(stage);
  if (normalized === 'TargetSchool') return 5;
  if (normalized === 'Called') return 10;
  if (normalized === 'DocumentSent') return 15;
  if (normalized === 'Appointed') return 20;
  if (normalized === 'Presented') return 35;
  if (normalized === 'DemoWorkshop') return 55;
  if (normalized === 'Quotation') return 75;
  if (normalized === 'Won') return 100;
  if (normalized === 'Lost') return 0;
  return 20;
}

export function stageRequiresEventAt(stage: SalesFunnelStage): boolean {
  return stage === 'Appointed' || stage === 'Presented' || stage === 'DemoWorkshop';
}

export function scoreFromStage(stage: SalesFunnelStage): number {
  const temperature = temperatureFromStage(stage);
  if (stage === 'Lost') return 0;
  if (temperature === 'Customer') return 100;
  if (temperature === 'Hot') return 85;
  if (temperature === 'Warm') return 60;
  return 10;
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
