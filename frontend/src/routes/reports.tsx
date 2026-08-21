import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { BarChart3, CalendarClock, Download, FileText, GitBranch, Printer, School, Search, TrendingUp, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { TASK_TYPES, formatTaskType } from '../lib/task-types';
import { ModalShell, PaginationControls } from '../components/ui';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/reports',
  component: ReportsComponent,
});

type ActivityTypeFilter = 'all' | 'Call' | 'Meeting' | 'Presentation' | 'Demo' | 'FollowUp' | 'Other';
type DetailModalKey =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'overdueNow'
  | 'overdueInRange'
  | 'slaCompleted'
  | 'slaBreached'
  | null;

const MODAL_PAGE_SIZE = 15;

function formatFilterDate(value: string) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('th-TH');
}

function ReportsComponent() {
  const [leads, setLeads] = useState<any[]>([]);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activityType, setActivityType] = useState<ActivityTypeFilter>('all');
  const [activitySearch, setActivitySearch] = useState('');
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

  const leadById = (id?: string) => leads.find(lead => lead._id === id);
  const metrics = reportSummary?.metrics || {};
  const hasDateFilter = Boolean(dateFrom || dateTo);

  const cards = useMemo(() => [
    {
      label: hasDateFilter ? 'กิจกรรมในช่วงที่เลือก' : 'กิจกรรมทั้งหมด',
      value: metrics.activitiesInRange ?? 0,
      icon: CalendarClock,
      tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: hasDateFilter ? 'Hot Leads (ในช่วง)' : 'Hot Leads',
      value: metrics.hotLeadsInRange ?? 0,
      icon: School,
      tone: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
    },
    {
      label: 'ใบเสนอราคาอนุมัติ',
      value: metrics.approvedQuotesInRange ?? 0,
      icon: FileText,
      tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'มูลค่าอนุมัติ',
      value: `${Number(metrics.approvedValueInRange || 0).toLocaleString('th-TH')} ฿`,
      icon: TrendingUp,
      tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    },
  ], [hasDateFilter, metrics]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (dateFrom || dateTo) {
      parts.push(`${formatFilterDate(dateFrom) || 'เริ่มต้น'} – ${formatFilterDate(dateTo) || 'ปัจจุบัน'}`);
    } else {
      parts.push('แสดงทั้งหมด');
    }
    if (activityType !== 'all') {
      parts.push(`ประเภท: ${formatTaskType(activityType)}`);
    }
    return parts.join(' · ');
  }, [dateFrom, dateTo, activityType]);

  const sortedActivities = useMemo(() => {
    const activities = Array.isArray(reportSummary?.activities) ? reportSummary.activities : [];
    const q = activitySearch.trim().toLowerCase();
    return activities.filter((activity: any) => {
      if (!q) return true;
      const school = leadById(activity.leadId)?.schoolName || '';
      const typeText = formatTaskType(activity.type, activity.typeLabel);
      return (
        String(activity.title || '').toLowerCase().includes(q) ||
        school.toLowerCase().includes(q) ||
        typeText.toLowerCase().includes(q)
      );
    });
  }, [reportSummary?.activities, activitySearch, leads]);

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
      default:
        return null;
    }
  }, [detailModal, reportSummary, overdueNowRows.length, overdueInRangeRows.length, slaCompletedRows.length, slaBreachedRows.length]);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">จากวันที่</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">ถึงวันที่</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">ประเภทกิจกรรม</label>
            <select value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityTypeFilter)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              <option value="all">ทั้งหมด</option>
              {TASK_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setDateFrom(''); setDateTo(''); setActivityType('all'); setActivitySearch(''); closeDetailModal(); }} className="w-full px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 hover:bg-slate-800">
              ล้างตัวกรอง
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">Report scope: {reportSummary?.scope === 'team' ? 'ทีม/องค์กรตามสิทธิ์' : 'ข้อมูลส่วนตัวตามสิทธิ์'}</span>
          <button onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </section>

      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 ${loading ? 'opacity-60' : ''}`}>
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`p-4 rounded-xl border ${card.tone}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{card.label}</span>
                <Icon size={18} />
              </div>
              <div className="mt-3 text-2xl font-black text-slate-100">{loading ? '...' : card.value}</div>
            </div>
          );
        })}
      </div>

      <section className={`p-6 rounded-2xl glass-panel space-y-4 ${loading ? 'opacity-60' : ''}`}>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Conversion funnel</h3>
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
                          {formatTaskType(row.type, row.typeLabel)}
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
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">กิจกรรมล่าสุด ({loading ? '...' : sortedActivities.length})</h3>
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="search"
              value={activitySearch}
              onChange={e => setActivitySearch(e.target.value)}
              placeholder="ค้นหากิจกรรม..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800">
          {sortedActivities.map((activity: any) => (
            <div key={activity._id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-slate-700">{formatTaskType(activity.type, activity.typeLabel)}</span>
                <h4 className="mt-1 text-xs font-semibold text-slate-200">{activity.title}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-1">{activity.description || leadById(activity.leadId)?.schoolName || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">
                {new Date(activity.startAt || activity.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          ))}
          {!loading && sortedActivities.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">ยังไม่มีข้อมูลกิจกรรมสำหรับรายงาน</div>
          )}
        </div>
      </section>
    </div>
  );
}
