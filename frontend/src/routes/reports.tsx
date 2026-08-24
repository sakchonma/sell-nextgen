import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { BarChart3, ChevronRight, Download, GitBranch, Printer, Search, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useActivityTypes } from '../hooks/useActivityTypes';
import { formatTaskType } from '../lib/task-types';
import { dateKey } from '../lib/datetime';
import { FUNNEL_DISPLAY_STAGE_CODES, getPipelineColumnStyle, getSalesFunnelStageLabel } from '../lib/sales-funnel-stages';
import { ModalShell, PaginationControls } from '../components/ui';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/reports',
  component: ReportsComponent,
});

type ActivityTypeFilter = 'all' | string;
type DetailModalKey =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'overdueNow'
  | 'overdueInRange'
  | 'slaCompleted'
  | 'slaBreached'
  | 'funnelCalled'
  | 'funnelDocumentSent'
  | 'funnelAppointed'
  | 'funnelPresented'
  | 'funnelDemoWorkshop'
  | 'funnelQuotation'
  | 'funnelWon'
  | 'funnelLost'
  | null;

const FUNNEL_ROW_1 = ['Called', 'DocumentSent', 'Appointed', 'Presented'] as const;
const FUNNEL_ROW_2 = ['DemoWorkshop', 'Quotation', 'Won', 'Lost'] as const;

function emptyFunnelStage(code: string) {
  return {
    code,
    label: code,
    labelTh: getSalesFunnelStageLabel(code),
    count: 0,
    value: 0,
    conversionToNextPercent: 0,
    items: [],
  };
}

function getFunnelDisplayLabel(row: { code?: string; label?: string; labelTh?: string }) {
  return row.labelTh || row.label || row.code || '-';
}
const MODAL_PAGE_SIZE = 15;
const ACTIVITY_PAGE_SIZE = 10;

function formatFilterDate(value: string) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('th-TH');
}

type DateRangePreset = 'today' | 'week' | 'month';

function getDateRangePreset(preset: DateRangePreset) {
  const now = new Date();
  const today = dateKey(now);

  if (preset === 'today') {
    return { from: today, to: today };
  }

  if (preset === 'week') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { from: dateKey(start), to: dateKey(end) };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: dateKey(start), to: dateKey(end) };
}

const DATE_RANGE_PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'today', label: 'วันปัจจุบัน' },
  { id: 'week', label: 'สัปดาห์ปัจจุบัน' },
  { id: 'month', label: 'เดือนปัจจุบัน' },
];

function ReportsComponent() {
  const { types: activityTypes, selectOptions: activityTypeOptions } = useActivityTypes();
  const [leads, setLeads] = useState<any[]>([]);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState<DateRangePreset | null>(null);
  const [activityType, setActivityType] = useState<ActivityTypeFilter>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [detailModal, setDetailModal] = useState<DetailModalKey>(null);
  const [modalPage, setModalPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (activityType !== 'all') params.set('activityType', activityType);

    Promise.all([
      apiFetch(`/api/reports/summary?${params.toString()}`).catch(() => null),
      apiFetch('/api/leads').catch(() => []),
    ])
      .then(([summaryData, leadData]) => {
        setReportSummary(summaryData);
        setLeads(Array.isArray(leadData) ? leadData : []);
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, activityType]);

  useEffect(() => {
    setActivityPage(1);
  }, [activitySearch, dateFrom, dateTo, activityType]);

  const leadById = (id?: string) => leads.find(lead => lead._id === id);
  const metrics = reportSummary?.metrics || {};
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const salesFunnelStages = useMemo(
    () => (Array.isArray(reportSummary?.salesFunnel?.stages) ? reportSummary.salesFunnel.stages : []),
    [reportSummary?.salesFunnel?.stages]
  );
  const funnelStageByCode = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of salesFunnelStages) map.set(row.code, row);
    return map;
  }, [salesFunnelStages]);

  const funnelModalKeyByCode: Record<string, Exclude<DetailModalKey, null>> = {
    Called: 'funnelCalled',
    DocumentSent: 'funnelDocumentSent',
    Appointed: 'funnelAppointed',
    Presented: 'funnelPresented',
    DemoWorkshop: 'funnelDemoWorkshop',
    Quotation: 'funnelQuotation',
    Won: 'funnelWon',
    Lost: 'funnelLost',
  };

  const funnelDisplayStages = useMemo(
    () => FUNNEL_DISPLAY_STAGE_CODES.map(code => funnelStageByCode.get(code) || emptyFunnelStage(code)),
    [funnelStageByCode]
  );
  const funnelMaxCount = useMemo(
    () => Math.max(1, ...funnelDisplayStages.map((row: any) => row.count || 0)),
    [funnelDisplayStages]
  );

  const renderFunnelCard = (row: any, showArrow: boolean) => {
    const barWidth = Math.max(8, Math.round((Number(row.count || 0) / funnelMaxCount) * 100));
    const stageTone = getPipelineColumnStyle(row.code);
    return (
      <div key={row.code} className="flex items-stretch flex-1 min-w-0">
        <button
          type="button"
          onClick={() => openDetailModal(funnelModalKeyByCode[row.code])}
          className={`group flex-1 p-4 rounded-xl border text-left transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer ${stageTone}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider leading-tight">{getFunnelDisplayLabel(row)}</span>
            <GitBranch size={14} className="opacity-60 group-hover:opacity-100 shrink-0" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <span className="text-3xl font-black text-slate-100 tabular-nums leading-none">{loading ? '…' : row.count || 0}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Leads</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-200 tabular-nums">
            {Number(row.value || 0).toLocaleString('th-TH')} <span className="text-[10px] font-normal text-slate-500">฿</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-900/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-current opacity-70 transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </button>
        {showArrow && (
          <div className="flex flex-col items-center justify-center px-1.5 sm:px-2 shrink-0 self-center py-2">
            <ChevronRight size={16} className="text-slate-600" />
            <span className="mt-0.5 text-[9px] font-bold text-slate-500 whitespace-nowrap tabular-nums">
              {row.conversionToNextPercent ?? 0}%
            </span>
          </div>
        )}
      </div>
    );
  };

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (dateFrom || dateTo) {
      parts.push(`${formatFilterDate(dateFrom) || 'เริ่มต้น'} – ${formatFilterDate(dateTo) || 'ปัจจุบัน'}`);
    } else {
      parts.push('แสดงทั้งหมด');
    }
    if (activityType !== 'all') {
      parts.push(`ประเภท: ${formatTaskType(activityType, undefined, activityTypes)}`);
    }
    return parts.join(' · ');
  }, [dateFrom, dateTo, activityType]);

  const sortedActivities = useMemo(() => {
    const activities = Array.isArray(reportSummary?.activities) ? reportSummary.activities : [];
    const q = activitySearch.trim().toLowerCase();
    return activities.filter((activity: any) => {
      if (!q) return true;
      const school = leadById(activity.leadId)?.schoolName || '';
      const typeText = formatTaskType(activity.type, activity.typeLabel, activityTypes);
      return (
        String(activity.title || '').toLowerCase().includes(q) ||
        school.toLowerCase().includes(q) ||
        typeText.toLowerCase().includes(q)
      );
    });
  }, [reportSummary?.activities, activitySearch, leads]);

  const pagedActivities = useMemo(() => {
    const start = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
    return sortedActivities.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [sortedActivities, activityPage]);

  const exportCsv = () => {
    const rows = [
      ['section', 'metric', 'value'],
      ['filter', 'dateFrom', dateFrom || 'all'],
      ['filter', 'dateTo', dateTo || 'all'],
      ['filter', 'activityType', activityType],
      ['metrics', 'activitiesInRange', metrics.activitiesInRange ?? 0],
      ['metrics', 'hotLeadsInRange', metrics.hotLeadsInRange ?? 0],
      ['metrics', 'approvedQuotesInRange', metrics.approvedQuotesInRange ?? 0],
      ['metrics', 'approvedValueInRange', metrics.approvedValueInRange ?? 0],
      ['metrics', 'leads', metrics.leads ?? 0],
      ['metrics', 'opportunities', metrics.opportunities ?? 0],
      ['metrics', 'quotes', metrics.quotes ?? 0],
      ['metrics', 'wonValue', metrics.wonValue ?? 0],
      ['quoteApproval', 'approved', reportSummary?.quoteApproval?.approved ?? 0],
      ['quoteApproval', 'pending', reportSummary?.quoteApproval?.pending ?? 0],
      ['quoteApproval', 'rejected', reportSummary?.quoteApproval?.rejected ?? 0],
      ['quoteApproval', 'approvedValue', reportSummary?.quoteApproval?.approvedValue ?? 0],
      ['requestSla', 'breached', reportSummary?.requestSla?.breached ?? 0],
      ['taskReport', 'overdueNow', reportSummary?.taskReport?.overdueNow ?? 0],
      ['taskReport', 'overdueInRange', reportSummary?.taskReport?.overdueInRange ?? 0],
      ...(salesFunnelStages.map((row: any) => ['salesFunnel', `${row.labelTh || row.label}_count`, row.count ?? 0])),
      ...(salesFunnelStages.map((row: any) => ['salesFunnel', `${row.labelTh || row.label}_value`, row.value ?? 0])),
      ...(salesFunnelStages.map((row: any) => ['salesFunnel', `${row.labelTh || row.label}_conversion`, row.conversionToNextPercent ?? 0])),
      ...((reportSummary?.salesForecast || []).map((row: any) => ['salesForecast', row.ownerName, row.weightedForecast])),
      ...((reportSummary?.salesPerformance || []).map((row: any) => ['salesPerformance', row.name, row.wonValue])),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nextgen-report-summary.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openDetailModal = (key: Exclude<DetailModalKey, null>) => {
    setDetailModal(key);
    setModalPage(1);
  };

  const closeDetailModal = () => {
    setDetailModal(null);
    setModalPage(1);
  };

  const applyDatePreset = (preset: DateRangePreset) => {
    const range = getDateRangePreset(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
    setDatePreset(preset);
    setActivityPage(1);
    closeDetailModal();
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setDatePreset(null);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setDatePreset(null);
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDatePreset(null);
    setActivityType('all');
    setActivitySearch('');
    setActivityPage(1);
    closeDetailModal();
  };

  const quoteRows = (status: 'approved' | 'pending' | 'rejected') =>
    reportSummary?.quoteApproval?.quotesByStatus?.[status] || [];

  const overdueNowRows = reportSummary?.taskReport?.overdueNowTasks || [];
  const overdueInRangeRows = reportSummary?.taskReport?.overdueInRangeTasks || [];
  const slaRows = reportSummary?.requestSla?.rows || [];
  const slaCompletedRows = slaRows.filter((row: any) => row.status === 'Completed');
  const slaBreachedRows = slaRows.filter((row: any) => row.breached);

  const modalConfig = useMemo(() => {
    switch (detailModal) {
      case 'approved':
        return { title: 'ใบเสนอราคาที่อนุมัติ', subtitle: `${quoteRows('approved').length} รายการ`, kind: 'quote' as const, rows: quoteRows('approved') };
      case 'pending':
        return { title: 'ใบเสนอราคารออนุมัติ', subtitle: `${quoteRows('pending').length} รายการ`, kind: 'quote' as const, rows: quoteRows('pending') };
      case 'rejected':
        return { title: 'ใบเสนอราคาที่ปฏิเสธ', subtitle: `${quoteRows('rejected').length} รายการ`, kind: 'quote' as const, rows: quoteRows('rejected') };
      case 'overdueNow':
        return { title: 'งานค้าง ณ วันนี้', subtitle: `${overdueNowRows.length} รายการ`, kind: 'task' as const, rows: overdueNowRows };
      case 'overdueInRange':
        return { title: 'งานค้างในช่วงที่เลือก', subtitle: `${overdueInRangeRows.length} รายการ`, kind: 'task' as const, rows: overdueInRangeRows };
      case 'slaCompleted':
        return { title: 'คำขอที่เสร็จสิ้น', subtitle: `${slaCompletedRows.length} รายการ`, kind: 'sla' as const, rows: slaCompletedRows };
      case 'slaBreached':
        return { title: 'คำขอที่เกิน SLA', subtitle: `${slaBreachedRows.length} รายการ`, kind: 'sla' as const, rows: slaBreachedRows };
      case 'funnelCalled':
      case 'funnelDocumentSent':
      case 'funnelAppointed':
      case 'funnelPresented':
      case 'funnelDemoWorkshop':
      case 'funnelQuotation':
      case 'funnelWon':
      case 'funnelLost': {
        const code = detailModal.replace('funnel', '');
        const stage = funnelStageByCode.get(code);
        const items = stage?.items || [];
        return {
          title: `Sales Funnel · ${getFunnelDisplayLabel(stage || { code })}`,
          subtitle: `${items.length} โรงเรียน · มูลค่ารวม ${Number(stage?.value || 0).toLocaleString('th-TH')} ฿`,
          kind: 'funnelLead' as const,
          rows: items,
        };
      }
      default:
        return null;
    }
  }, [detailModal, reportSummary, overdueNowRows.length, overdueInRangeRows.length, slaCompletedRows.length, slaBreachedRows.length, funnelStageByCode]);

  const pagedModalRows = useMemo(() => {
    if (!modalConfig) return [];
    const start = (modalPage - 1) * MODAL_PAGE_SIZE;
    return modalConfig.rows.slice(start, start + MODAL_PAGE_SIZE);
  }, [modalConfig, modalPage]);

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div>
        <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
          <BarChart3 className="text-indigo-400" /> รายงานกิจกรรม
        </h2>
        <p className="text-xs text-slate-400 mt-1">ภาพรวมกิจกรรมขาย Leads และใบเสนอราคาจากข้อมูลที่ระบบมีอยู่</p>
        <p className="text-[10px] text-indigo-300 mt-1">{filterSummary}</p>
      </div>

      <section className="p-4 rounded-2xl glass-panel">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">จากวันที่</label>
            <input type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">ถึงวันที่</label>
            <input type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 hover:bg-slate-800">
              ล้างตัวกรอง
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DATE_RANGE_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={datePreset === preset.id}
              onClick={() => applyDatePreset(preset.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                datePreset === preset.id
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-[10px] font-bold text-slate-500">ประเภทกิจกรรม</label>
            <span className="text-[10px] text-slate-500">ทั้งหมด {activityTypeOptions.length} ประเภท</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={activityType === 'all'}
              onClick={() => setActivityType('all')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activityType === 'all'
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              ทั้งหมด
            </button>
            {activityTypeOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={activityType === opt.value}
                onClick={() => setActivityType(opt.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  activityType === opt.value
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">Report scope: {reportSummary?.scope === 'team' ? 'ทีม/องค์กรตามสิทธิ์' : 'ข้อมูลส่วนตัวตามสิทธิ์'}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              <Download size={14} /> Export CSV
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800">
              <Printer size={14} /> Print / PDF
            </button>
          </div>
        </div>
      </section>

      <section className={`p-6 rounded-2xl glass-panel space-y-5 ${loading ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">สรุป Sales Funnel</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {hasDateFilter
                ? 'Lead ที่ติดต่อล่าสุดหรือมีวันนัดในช่วงที่เลือก · กดการ์ดเพื่อดูรายละเอียด'
                : 'จำนวน Lead และมูลค่าตามสถานะการขายปัจจุบัน · กดการ์ดเพื่อดูรายละเอียด'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-slate-300">
              Pipeline <strong className="text-slate-100">{Number(reportSummary?.salesFunnel?.totals?.pipelineValue || 0).toLocaleString('th-TH')} ฿</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
              Won <strong>{Number(reportSummary?.salesFunnel?.totals?.wonValue || 0).toLocaleString('th-TH')} ฿</strong>
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-stretch w-full gap-0">
            {FUNNEL_ROW_1.map((code, index) =>
              renderFunnelCard(funnelStageByCode.get(code) || emptyFunnelStage(code), index < FUNNEL_ROW_1.length - 1)
            )}
          </div>
          <div className="flex items-stretch w-full gap-0">
            {FUNNEL_ROW_2.map((code, index) =>
              renderFunnelCard(funnelStageByCode.get(code) || emptyFunnelStage(code), index < FUNNEL_ROW_2.length - 1)
            )}
          </div>
        </div>
      </section>

      <section className={`p-6 rounded-2xl glass-panel space-y-4 ${loading ? 'opacity-60' : ''}`}>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ภาพรวม Lead → Quote → Won</h3>
          {hasDateFilter ? (
            <p className="text-[11px] text-slate-500 mt-1">Lead/Quote/Won ที่เกี่ยวข้องกับช่วงวันที่ที่เลือก</p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ['Leads', reportSummary?.funnel?.leads || 0, '/leads'],
            ['Opportunities', reportSummary?.funnel?.opportunities || 0, '/pipeline'],
            ['Quotes', reportSummary?.funnel?.quotes || 0, '/quotes'],
            ['Won', reportSummary?.funnel?.won || 0, '/pipeline'],
          ].map(([label, value, href]) => (
            <a key={label} href={href as string} className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                <GitBranch size={15} className="text-indigo-400" />
              </div>
              <span className="block mt-2 text-xl font-black text-slate-100">{loading ? '...' : value}</span>
            </a>
          ))}
        </div>
      </section>

      <section className={`grid grid-cols-1 xl:grid-cols-2 gap-4 ${loading ? 'opacity-60' : ''}`}>
        <div className="p-6 rounded-2xl glass-panel space-y-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Quote approval report</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button type="button" onClick={() => openDetailModal('approved')} className="p-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 cursor-pointer text-left transition-all hover:scale-[1.01]">
              <span className="block text-3xl font-black leading-none">{loading ? '...' : reportSummary?.quoteApproval?.approved || 0}</span>
              <span className="block mt-2 text-sm font-semibold">Approved</span>
              <span className="block mt-1 text-xs text-emerald-200/80">กดเพื่อดูรายละเอียด</span>
            </button>
            <button type="button" onClick={() => openDetailModal('pending')} className="p-5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 cursor-pointer text-left transition-all hover:scale-[1.01]">
              <span className="block text-3xl font-black leading-none">{loading ? '...' : reportSummary?.quoteApproval?.pending || 0}</span>
              <span className="block mt-2 text-sm font-semibold">Pending</span>
              <span className="block mt-1 text-xs text-amber-200/80">กดเพื่อดูรายละเอียด</span>
            </button>
            <button type="button" onClick={() => openDetailModal('rejected')} className="p-5 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 cursor-pointer text-left transition-all hover:scale-[1.01]">
              <span className="block text-3xl font-black leading-none">{loading ? '...' : reportSummary?.quoteApproval?.rejected || 0}</span>
              <span className="block mt-2 text-sm font-semibold">Rejected</span>
              <span className="block mt-1 text-xs text-rose-200/80">กดเพื่อดูรายละเอียด</span>
            </button>
          </div>
          <div className="text-sm text-slate-400">
            มูลค่าอนุมัติ:{' '}
            <span className="text-slate-100 font-bold text-base">
              {loading ? '...' : Number(reportSummary?.quoteApproval?.approvedValue || 0).toLocaleString('th-TH')} ฿
            </span>
          </div>
        </div>

        <div className="p-6 rounded-2xl glass-panel space-y-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Request SLA / Task overdue</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <button type="button" onClick={() => openDetailModal('slaCompleted')} className="p-5 rounded-xl border border-slate-800 bg-[#121826]/40 hover:bg-slate-800/40 cursor-pointer text-left transition-all hover:scale-[1.01]">
              <span className="block text-3xl font-black leading-none text-slate-100">{loading ? '...' : reportSummary?.requestSla?.completed || 0}</span>
              <span className="block mt-2 text-sm font-semibold text-slate-300">Completed</span>
              <span className="block mt-1 text-xs text-slate-500">กดเพื่อดูรายละเอียด</span>
            </button>
            <button type="button" onClick={() => openDetailModal('slaBreached')} className="p-5 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 cursor-pointer text-left transition-all hover:scale-[1.01]">
              <span className="block text-3xl font-black leading-none">{loading ? '...' : reportSummary?.requestSla?.breached || 0}</span>
              <span className="block mt-2 text-sm font-semibold">SLA Breach</span>
              <span className="block mt-1 text-xs text-rose-200/80">กดเพื่อดูรายละเอียด</span>
            </button>
            <button type="button" onClick={() => openDetailModal('overdueNow')} className="p-5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 cursor-pointer text-left transition-all hover:scale-[1.01]">
              <span className="block text-3xl font-black leading-none">{loading ? '...' : reportSummary?.taskReport?.overdueNow || 0}</span>
              <span className="block mt-2 text-sm font-semibold">Overdue วันนี้</span>
              <span className="block mt-1 text-xs text-amber-200/80">กดเพื่อดูรายละเอียด</span>
            </button>
            <button
              type="button"
              onClick={() => openDetailModal('overdueInRange')}
              disabled={!hasDateFilter}
              className="p-5 rounded-xl border border-orange-500/25 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15 cursor-pointer text-left transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <span className="block text-3xl font-black leading-none">{loading ? '...' : reportSummary?.taskReport?.overdueInRange || 0}</span>
              <span className="block mt-2 text-sm font-semibold">Overdue ในช่วง</span>
              <span className="block mt-1 text-xs text-orange-200/80">{hasDateFilter ? 'กดเพื่อดูรายละเอียด' : 'ต้องเลือกช่วงวันที่'}</span>
            </button>
          </div>
        </div>
      </section>

      {detailModal && modalConfig && (
        <ModalShell>
          <div className="w-full max-w-4xl max-h-[calc(100dvh-var(--app-modal-top)-2rem)] overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-100">{modalConfig.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{modalConfig.subtitle}</p>
              </div>
              <button type="button" onClick={closeDetailModal} className="text-slate-500 hover:text-slate-200 p-1" title="ปิด">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {pagedModalRows.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-base">ไม่มีรายการ</div>
              ) : modalConfig.kind === 'funnelLead' ? (
                pagedModalRows.map((row: any) => (
                  <a
                    key={row.id}
                    href={`/leads/${row.id}`}
                    className="block p-4 rounded-xl border border-slate-800 bg-[#090d16]/50 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-slate-100">{row.schoolName}</div>
                        <div className="text-sm text-slate-400 mt-1">{row.zone || '-'} · {row.status || '-'}</div>
                        {row.updatedAt && (
                          <div className="text-xs text-slate-500 mt-1">
                            อัปเดต {new Date(row.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                      <div className="text-lg font-black text-indigo-300 shrink-0">{Number(row.value || 0).toLocaleString('th-TH')} ฿</div>
                    </div>
                  </a>
                ))
              ) : modalConfig.kind === 'quote' ? (
                pagedModalRows.map((row: any) => (
                  <a
                    key={row.id}
                    href="/quotes"
                    className="block p-4 rounded-xl border border-slate-800 bg-[#090d16]/50 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-slate-100">{row.quoteNumber}</div>
                        <div className="text-sm text-slate-400 mt-1">{leadById(row.leadId)?.schoolName || row.leadId || 'ไม่ระบุโรงเรียน'}</div>
                        {row.createdAt && (
                          <div className="text-xs text-slate-500 mt-1">
                            สร้างเมื่อ {new Date(row.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                      <div className="text-lg font-black text-indigo-300 shrink-0">{Number(row.totalAmount || 0).toLocaleString('th-TH')} ฿</div>
                    </div>
                  </a>
                ))
              ) : modalConfig.kind === 'task' ? (
                pagedModalRows.map((row: any) => (
                  <a
                    key={row.id}
                    href="/tasks"
                    className="block p-4 rounded-xl border border-slate-800 bg-[#090d16]/50 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-slate-100">{row.title}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          {formatTaskType(row.type, row.typeLabel, activityTypes)}
                          {leadById(row.leadId)?.schoolName ? ` · ${leadById(row.leadId)?.schoolName}` : ''}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-amber-300 shrink-0">
                        ครบกำหนด {new Date(row.endAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                pagedModalRows.map((row: any) => (
                  <a
                    key={row.requestNumber}
                    href="/requests"
                    className="block p-4 rounded-xl border border-slate-800 bg-[#090d16]/50 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-slate-100">{row.requestNumber}</div>
                        <div className="text-sm text-slate-400 mt-1">{row.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{row.department || '-'} · {row.status}</div>
                      </div>
                      <div className={`text-sm font-semibold shrink-0 ${row.breached ? 'text-rose-300' : 'text-slate-400'}`}>
                        {row.priority}
                        {row.slaDueAt ? ` · ${new Date(row.slaDueAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/95">
              <div className="text-sm text-slate-400 mb-3">
                แสดง {pagedModalRows.length} จาก {modalConfig.rows.length} รายการ · หน้าละ {MODAL_PAGE_SIZE} รายการ
              </div>
              <div className="text-sm [&_button]:text-sm [&_button]:px-4 [&_button]:py-2.5 [&_span]:text-sm">
                <PaginationControls
                  page={modalPage}
                  total={modalConfig.rows.length}
                  limit={MODAL_PAGE_SIZE}
                  onPageChange={setModalPage}
                />
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      <section className={`p-6 rounded-2xl glass-panel space-y-4 ${loading ? 'opacity-60' : ''}`}>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Sales forecast</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[9.5px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Zone</th>
                <th className="py-2 pr-3 text-right">Deals</th>
                <th className="py-2 pr-3 text-right">Pipeline</th>
                <th className="py-2 text-right">Weighted Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(reportSummary?.salesForecast || []).map((row: any) => (
                <tr key={row.ownerId}>
                  <td className="py-2 pr-3 font-semibold text-slate-200">{row.ownerName}</td>
                  <td className="py-2 pr-3 text-slate-500">{row.zone}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.dealCount}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{Number(row.pipelineValue || 0).toLocaleString('th-TH')} ฿</td>
                  <td className="py-2 text-right text-slate-100 font-semibold">{Number(row.weightedForecast || 0).toLocaleString('th-TH')} ฿</td>
                </tr>
              ))}
              {!loading && (reportSummary?.salesForecast || []).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">ยังไม่มี forecast ในช่วงนี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`p-6 rounded-2xl glass-panel space-y-4 ${loading ? 'opacity-60' : ''}`}>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Sales performance by user/zone</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[9.5px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Zone</th>
                <th className="py-2 pr-3 text-right">Leads</th>
                <th className="py-2 pr-3 text-right">Quotes</th>
                <th className="py-2 pr-3 text-right">Won</th>
                <th className="py-2 text-right">Won Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(reportSummary?.salesPerformance || []).map((row: any) => (
                <tr key={row.userId}>
                  <td className="py-2 pr-3 font-semibold text-slate-200">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{row.zone}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.leads}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.quotes}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.won}</td>
                  <td className="py-2 text-right text-slate-100 font-semibold">{Number(row.wonValue || 0).toLocaleString('th-TH')} ฿</td>
                </tr>
              ))}
              {!loading && (reportSummary?.salesPerformance || []).length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">ยังไม่มีข้อมูล performance ในช่วงนี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`p-6 rounded-2xl glass-panel space-y-4 ${loading ? 'opacity-60' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">
            กิจกรรมล่าสุด ({loading ? '...' : sortedActivities.length})
          </h3>
          <div className="relative max-w-xs w-full">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="search"
              value={activitySearch}
              onChange={e => setActivitySearch(e.target.value)}
              placeholder="ค้นหากิจกรรม..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-800 min-h-[320px]">
          {pagedActivities.map((activity: any) => (
            <div key={activity._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-block px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-400 border border-slate-700">{formatTaskType(activity.type, activity.typeLabel, activityTypes)}</span>
                <h4 className="mt-2 text-sm font-semibold text-slate-200">{activity.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-1 mt-1">{activity.description || leadById(activity.leadId)?.schoolName || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                {new Date(activity.startAt || activity.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          ))}
          {!loading && sortedActivities.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-sm">ยังไม่มีข้อมูลกิจกรรมสำหรับรายงาน</div>
          )}
        </div>
        {!loading && sortedActivities.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <div className="text-sm text-slate-400 mb-3">
              แสดง {pagedActivities.length} จาก {sortedActivities.length} รายการ · หน้าละ {ACTIVITY_PAGE_SIZE} รายการ
            </div>
            <div className="text-sm [&_button]:text-sm [&_button]:px-4 [&_button]:py-2.5 [&_span]:text-sm">
              <PaginationControls
                page={activityPage}
                total={sortedActivities.length}
                limit={ACTIVITY_PAGE_SIZE}
                onPageChange={setActivityPage}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
