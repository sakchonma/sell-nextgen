export const SALES_FUNNEL_STAGES = [
  { code: 'Call', label: 'Call', labelTh: 'Call' },
  { code: 'Meeting', label: 'Meeting', labelTh: 'นัดหมาย' },
  { code: 'Presentation', label: 'Presentation', labelTh: 'Presentation' },
  { code: 'DemoWorkshop', label: 'Demo/Workshop', labelTh: 'Demo/Workshop' },
  { code: 'Quotation', label: 'Quotation', labelTh: 'Quotation' },
  { code: 'Won', label: 'Won', labelTh: 'Won' },
  { code: 'Lost', label: 'Lost', labelTh: 'Lost' },
] as const;

export type SalesFunnelStage = (typeof SALES_FUNNEL_STAGES)[number]['code'];

export const SALES_FUNNEL_STAGE_CODES = SALES_FUNNEL_STAGES.map(row => row.code);

export const SALES_FUNNEL_STAGE_OPTIONS = SALES_FUNNEL_STAGES.map(row => ({
  value: row.code,
  label: row.labelTh,
}));

export function getSalesFunnelStageLabel(code?: string) {
  const found = SALES_FUNNEL_STAGES.find(row => row.code === code);
  return found?.labelTh || found?.label || code || 'Call';
}

export function getSalesFunnelStageStyle(stage: string) {
  if (stage === 'Won') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (stage === 'Lost') return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
  if (stage === 'Quotation') return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
  if (stage === 'DemoWorkshop') return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
  if (stage === 'Presentation') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
  if (stage === 'Meeting') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
  if (stage === 'Call') return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
  return 'bg-slate-800 text-slate-400 border-slate-700';
}

export function getPipelineColumnStyle(stage: string) {
  if (stage === 'Won') return 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5';
  if (stage === 'Lost') return 'border-rose-500/20 text-rose-400 bg-rose-500/5';
  if (stage === 'Quotation') return 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5';
  if (stage === 'DemoWorkshop') return 'border-purple-500/20 text-purple-400 bg-purple-500/5';
  if (stage === 'Presentation') return 'border-cyan-500/20 text-cyan-400 bg-cyan-500/5';
  if (stage === 'Meeting') return 'border-amber-500/20 text-amber-400 bg-amber-500/5';
  if (stage === 'Call') return 'border-blue-500/20 text-blue-400 bg-blue-500/5';
  return 'border-slate-500/20 text-slate-400 bg-slate-500/5';
}
