import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Star,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { wrapFormSubmit } from '../hooks/useSaveConfirm';
import { ModalShell } from './ui';
import { FuzzySearchSelect } from './fuzzy-search-select';
import { provinceToZone } from '../lib/province-zone';
import {
  APPOINTMENT_KIND_OPTIONS,
  DOCUMENT_CHANNEL_OPTIONS,
  SALES_FUNNEL_STAGE_OPTIONS,
  getSalesFunnelStageLabel,
  getSalesFunnelStageStyle,
  getStageEventAtLabel,
  stageRequiresEventAt,
  temperatureFromStage,
} from '../lib/sales-funnel-stages';
import { SEGMENT_CONFIGS, facetLabel, formatProfileValue, type LeadSegment } from '../lib/lead-segments';

const PAGE_SIZE = 24;
const ZONE_OPTIONS = ['ภาคเหนือ', 'ภาคกลาง', 'ภาคตะวันออก', 'ภาคใต้', 'ภาคตะวันตก', 'ภาคอีสาน'];

interface FacetsResponse {
  total: number;
  stageCounts: Record<string, number>;
  provinces: string[];
  facets: Record<string, Array<{ value: string; count: number }>>;
  linked: { opportunities: number; openTasks: number };
}

const selectClass = 'px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[210px]';
const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500';

export function SegmentLeadsPage({ segment }: { segment: Exclude<LeadSegment, 'school'> }) {
  const config = SEGMENT_CONFIGS[segment];
  const Icon = segment === 'corporate' ? Building2 : GraduationCap;

  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [facets, setFacets] = useState<FacetsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [provinceFilter, setProvinceFilter] = useState('All');
  const [profileFilters, setProfileFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingLeadId, setUpdatingLeadId] = useState('');
  const [pendingStage, setPendingStage] = useState<{ lead: any; stage: string } | null>(null);
  const [documentChannel, setDocumentChannel] = useState('Email');
  const [appointmentKind, setAppointmentKind] = useState('Present');
  const [stageEventAt, setStageEventAt] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProvince, setNewProvince] = useState('');
  const [newZone, setNewZone] = useState('ภาคกลาง');
  const [newStage, setNewStage] = useState('TargetSchool');
  const [newProfile, setNewProfile] = useState<Record<string, string>>({});
  const [newContact, setNewContact] = useState({ name: '', position: '', phone: '', email: '' });
  const [addError, setAddError] = useState('');

  const observerRef = useRef<IntersectionObserver | null>(null);
  const requestSeqRef = useRef(0);
  const loadingRef = useRef(false);
  const lengthRef = useRef(0);

  const loadFacets = useCallback(() => {
    apiFetch<FacetsResponse>(`/api/leads/segment-facets?segment=${segment}`)
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [segment]);

  const buildQuery = useCallback((offset: number) => {
    const params = new URLSearchParams({
      segment,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      search,
      stage: stageFilter,
      assignedTo: ownerFilter,
      province: provinceFilter,
    });
    for (const [key, value] of Object.entries(profileFilters)) {
      if (value && value !== 'All') params.set(`pf.${key}`, value);
    }
    return `/api/leads?${params.toString()}`;
  }, [ownerFilter, profileFilters, provinceFilter, search, segment, stageFilter]);

  const fetchLeads = useCallback((mode: 'reset' | 'append' = 'reset') => {
    if (loadingRef.current && mode === 'append') return;
    const offset = mode === 'append' ? lengthRef.current : 0;
    const seq = ++requestSeqRef.current;
    loadingRef.current = true;
    if (mode === 'reset') {
      lengthRef.current = 0;
      setLeads([]);
      setHasMore(true);
    }
    setLoading(true);
    apiFetch(buildQuery(offset))
      .then(data => {
        if (seq !== requestSeqRef.current) return;
        const items = Array.isArray(data) ? data : data.items || [];
        setLeads(prev => {
          const next = mode === 'append' ? [...prev, ...items] : items;
          lengthRef.current = next.length;
          return next;
        });
        setTotal(Array.isArray(data) ? items.length : Number(data.total || 0));
        setHasMore(Array.isArray(data) ? false : Boolean(data.hasMore));
      })
      .catch(err => setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => {
        if (seq === requestSeqRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      });
  }, [buildQuery]);

  const lastCardRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasMore) fetchLeads('append');
    }, { rootMargin: '240px' });
    if (node) observerRef.current.observe(node);
  }, [fetchLeads, hasMore, loading]);

  useEffect(() => {
    apiFetch('/api/users').then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => setUsers([]));
    loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    fetchLeads('reset');
  }, [fetchLeads]);

  const ownerName = (id?: string) => users.find(user => user._id === id)?.name || 'ไม่ระบุผู้ดูแล';
  const activeFilterCount = [stageFilter, ownerFilter, provinceFilter, ...Object.values(profileFilters)]
    .filter(value => value && value !== 'All').length + (search ? 1 : 0);

  const resetFilters = () => {
    setSearch('');
    setStageFilter('All');
    setOwnerFilter('All');
    setProvinceFilter('All');
    setProfileFilters({});
  };

  const applyStageChange = (lead: any, stage: string, extras?: Record<string, unknown>) => {
    const previousStage = lead.stage || 'TargetSchool';
    setUpdatingLeadId(lead._id);
    setLeads(prev => prev.map(item => item._id === lead._id ? { ...item, stage, status: temperatureFromStage(stage) } : item));
    apiJson(`/api/leads/${lead._id}`, { stage, ...extras }, { method: 'PUT' })
      .then(updated => {
        setLeads(prev => prev.map(item => item._id === lead._id ? updated : item));
        setPendingStage(null);
        setMessage(`อัปเดต "${lead.schoolName}" เป็น ${getSalesFunnelStageLabel(stage)} แล้ว — Pipeline และปฏิทินซิงก์ให้อัตโนมัติ`);
        loadFacets();
      })
      .catch(err => {
        setError(err.message || 'อัปเดตสถานะไม่สำเร็จ');
        setLeads(prev => prev.map(item => item._id === lead._id ? { ...item, stage: previousStage } : item));
      })
      .finally(() => setUpdatingLeadId(''));
  };

  const handleStageChange = (lead: any, stage: string) => {
    if ((lead.stage || 'TargetSchool') === stage) return;
    if (stage === 'DocumentSent' || stageRequiresEventAt(stage)) {
      setPendingStage({ lead, stage });
      setDocumentChannel(lead.documentChannel || 'Email');
      setAppointmentKind(lead.appointmentKind || 'Present');
      setStageEventAt('');
      return;
    }
    applyStageChange(lead, stage);
  };

  const handleAdd = () => {
    setAddError('');
    const profile = Object.fromEntries(Object.entries(newProfile).filter(([, value]) => value.trim()));
    const contact = newContact.name.trim()
      ? [{
          name: newContact.name.trim(),
          position: newContact.position.trim() || undefined,
          phone: newContact.phone.trim() || undefined,
          email: newContact.email.trim() || undefined,
        }]
      : [];
    apiJson('/api/leads', {
      schoolName: newName.trim(),
      province: newProvince.trim() || undefined,
      address: newProvince.trim() || undefined,
      zone: newZone,
      stage: newStage,
      source: 'Outbound',
      segment,
      segmentProfile: profile,
      contacts: contact,
    })
      .then(() => {
        setShowAdd(false);
        setNewName('');
        setNewProvince('');
        setNewStage('TargetSchool');
        setNewProfile({});
        setNewContact({ name: '', position: '', phone: '', email: '' });
        setMessage('เพิ่มข้อมูลเรียบร้อย');
        fetchLeads('reset');
        loadFacets();
      })
      .catch(err => setAddError(err.message || 'บันทึกไม่สำเร็จ'));
  };

  const stageSummary = [
    { label: 'ทั้งหมด', value: facets?.total ?? 0, tone: 'text-slate-100' },
    { label: 'ยังไม่ติดต่อ', value: facets?.stageCounts?.TargetSchool ?? 0, tone: 'text-slate-300' },
    {
      label: 'กำลังดำเนินการ',
      value: Object.entries(facets?.stageCounts || {})
        .filter(([stage]) => !['TargetSchool', 'Won', 'Lost'].includes(stage))
        .reduce((sum, [, count]) => sum + count, 0),
      tone: 'text-indigo-300',
    },
    { label: 'Won', value: facets?.stageCounts?.Won ?? 0, tone: 'text-emerald-300' },
    { label: 'ดีลใน Pipeline', value: facets?.linked?.opportunities ?? 0, tone: 'text-amber-300', to: '/pipeline' as const },
    { label: 'งานค้างในปฏิทิน', value: facets?.linked?.openTasks ?? 0, tone: 'text-rose-300', to: '/tasks' as const },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Icon className="text-indigo-400" /> {config.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{config.description}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <a
            href={`/api/leads/export.csv?segment=${segment}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700"
          >
            Export CSV
          </a>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Plus size={14} /> {config.addButton}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stageSummary.map(item => {
          const body = (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</div>
              <div className={`text-xl font-bold mt-1 ${item.tone}`}>{item.value.toLocaleString('th-TH')}</div>
            </>
          );
          return item.to ? (
            <Link key={item.label} to={item.to} className="p-3 rounded-xl border border-slate-800 bg-[#121826]/40 hover:border-indigo-500/40">{body}</Link>
          ) : (
            <div key={item.label} className="p-3 rounded-xl border border-slate-800 bg-[#121826]/40">{body}</div>
          );
        })}
      </div>

      {message && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">{message}</div>}
      {error && !showAdd && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-3 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={config.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className={selectClass} title="สถานะการขาย">
            <option value="All">สถานะการขาย: ทั้งหมด</option>
            {SALES_FUNNEL_STAGE_OPTIONS.map(stage => (
              <option key={stage.value} value={stage.value}>
                {stage.value === 'TargetSchool' ? 'เป้าหมาย (ยังไม่ติดต่อ)' : stage.label} ({facets?.stageCounts?.[stage.value] ?? 0})
              </option>
            ))}
          </select>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className={selectClass} title="ผู้ดูแล">
            <option value="All">ผู้ดูแล: ทุกคน</option>
            {users.map(user => <option key={user._id} value={user._id}>{user.name}</option>)}
          </select>
          <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} className={selectClass} title="จังหวัด">
            <option value="All">จังหวัด: ทั้งหมด</option>
            {(facets?.provinces || []).map(province => <option key={province} value={province}>{province}</option>)}
          </select>
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800">
              <RotateCcw size={12} /> ล้างตัวกรอง ({activeFilterCount})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs text-slate-500 flex items-center gap-1"><Filter size={12} /> กรองตามข้อมูลจากไฟล์:</span>
          {config.filters.map(filter => (
            <select
              key={filter.key}
              value={profileFilters[filter.key] || 'All'}
              onChange={e => setProfileFilters(prev => ({ ...prev, [filter.key]: e.target.value }))}
              className={selectClass}
              title={filter.label}
            >
              <option value="All">{filter.label}: ทั้งหมด</option>
              {(facets?.facets?.[filter.key] || []).map(option => (
                <option key={option.value} value={option.value}>
                  {facetLabel(filter, option.value)} ({option.count})
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>แสดง {leads.length.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ</span>
        {loading && leads.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-indigo-400"><Loader2 size={12} className="animate-spin" /> กำลังโหลดข้อมูล</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {leads.map((lead, index) => {
          const profile = lead.segmentProfile || {};
          const nextAction = config.nextActionKeys.map(key => profile[key]).find(Boolean);
          const highlighted = segment === 'corporate' ? profile.isTop20 === true : profile.startFirst === true;
          return (
            <div
              key={lead._id}
              ref={index === leads.length - 1 ? lastCardRef : undefined}
              className="p-5 rounded-2xl glass-card text-left flex flex-col gap-3 border border-slate-800 bg-[#121826]/30"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  to="/leads/$leadId"
                  params={{ leadId: lead._id }}
                  search={{ from: segment } as any}
                  className="font-bold text-slate-100 hover:text-indigo-300 font-display text-[15px] leading-snug line-clamp-2 hover:underline"
                >
                  {lead.schoolName}
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {highlighted && (
                    <span title={segment === 'corporate' ? '20 รายชุดแรก' : '5 คณะแรก'} className="text-amber-300"><Star size={14} fill="currentColor" /></span>
                  )}
                  {profile.tier && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                      {String(profile.tier)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <div className="relative">
                  <select
                    value={SALES_FUNNEL_STAGE_OPTIONS.some(opt => opt.value === lead.stage) ? lead.stage : 'TargetSchool'}
                    onChange={e => handleStageChange(lead, e.target.value)}
                    disabled={updatingLeadId === lead._id}
                    className={`appearance-none max-w-40 pr-6 pl-2 py-1 rounded text-[10px] border font-bold outline-none cursor-pointer disabled:cursor-wait ${getSalesFunnelStageStyle(lead.stage || 'TargetSchool')}`}
                    title="สถานะการขาย (ซิงก์ไป Pipeline)"
                  >
                    {SALES_FUNNEL_STAGE_OPTIONS.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-1.5 top-1 text-[9px]">▾</span>
                </div>
                {config.cardChips.map(chip => {
                  const text = formatProfileValue(profile[chip.key], chip.kind);
                  return text ? (
                    <span key={chip.key} title={chip.label} className="px-2 py-1 rounded text-[10px] border border-slate-800 text-slate-400 max-w-[220px] truncate">
                      {text}
                    </span>
                  ) : null;
                })}
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <MapPin size={10} /> {lead.address || lead.province || '-'} {lead.zone ? `(${lead.zone})` : ''}
              </span>

              {nextAction && (
                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3 border-l-2 border-indigo-500/40 pl-2">
                  {String(nextAction)}
                </p>
              )}

              <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-[11px]">
                <span className="flex flex-1 items-center gap-1 text-slate-400 min-w-0">
                  <UserCheck size={12} className="shrink-0" />
                  <span className="truncate">{ownerName(lead.assignedTo)} · ผู้ติดต่อ {lead.contacts?.length || 0}</span>
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {lead.nextCallAt && (
                    <span className="flex items-center gap-1 whitespace-nowrap text-amber-300" title="นัดติดตาม (อยู่ในปฏิทิน)">
                      <CalendarClock size={12} /> {formatProfileValue(String(lead.nextCallAt).slice(0, 10), 'date')}
                    </span>
                  )}
                  <Link to="/leads/$leadId" params={{ leadId: lead._id }}
                  search={{ from: segment } as any} className="flex items-center gap-0.5 text-indigo-300 font-semibold hover:underline">
                    จัดการ <TrendingUp size={10} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        {leads.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs">{config.emptyText}</div>
        )}
      </div>

      {loading && leads.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin text-indigo-400" /> กำลังโหลดเพิ่ม
        </div>
      )}
      {!hasMore && leads.length > 0 && <div className="py-4 text-center text-[11px] text-slate-500">โหลดข้อมูลครบแล้ว</div>}

      {showAdd && (
        <ModalShell>
          <form onSubmit={wrapFormSubmit(handleAdd)} className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">{config.addButton}</h3>
            {addError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 whitespace-pre-line">{addError}</div>}
            <label className="block text-xs text-slate-400 font-semibold">
              {config.nameLabel}
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={config.namePlaceholder} className={`${inputClass} mt-1`} required />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">จังหวัด</label>
                <FuzzySearchSelect
                  value={newProvince}
                  onChange={next => {
                    setNewProvince(next);
                    if (next.trim()) setNewZone(provinceToZone(next));
                  }}
                  options={facets?.provinces || []}
                  placeholder="เช่น กรุงเทพมหานคร"
                />
              </div>
              <label className="block text-xs text-slate-400 font-semibold">
                ภาค
                <select value={newZone} onChange={e => setNewZone(e.target.value)} className={`${inputClass} mt-1`}>
                  {ZONE_OPTIONS.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-400 font-semibold">
              สถานะการขาย
              <select value={newStage} onChange={e => setNewStage(e.target.value)} className={`${inputClass} mt-1`}>
                {SALES_FUNNEL_STAGE_OPTIONS.filter(stage => !stageRequiresEventAt(stage.value) && stage.value !== 'DocumentSent').map(stage => (
                  <option key={stage.value} value={stage.value}>{stage.label}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.createFields.map(field => (
                <label key={field.key} className="block text-xs text-slate-400 font-semibold">
                  {field.label}
                  <input
                    value={newProfile[field.key] || ''}
                    onChange={e => setNewProfile(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  />
                </label>
              ))}
            </div>
            <div className="p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">ผู้ติดต่อ (ไม่บังคับ)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} placeholder="ชื่อ" className={inputClass} />
                <input value={newContact.position} onChange={e => setNewContact({ ...newContact, position: e.target.value })} placeholder="ตำแหน่ง" className={inputClass} />
                <input value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} placeholder="เบอร์โทร" className={inputClass} />
                <input type="email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} placeholder="อีเมล" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">บันทึก</button>
            </div>
          </form>
        </ModalShell>
      )}

      {pendingStage && (
        <ModalShell>
          <form
            onSubmit={wrapFormSubmit(() => {
              const extras: Record<string, unknown> = {};
              if (pendingStage.stage === 'DocumentSent') extras.documentChannel = documentChannel;
              if (pendingStage.stage === 'Appointed') extras.appointmentKind = appointmentKind;
              if (stageRequiresEventAt(pendingStage.stage)) extras.stageEventAt = new Date(stageEventAt).toISOString();
              applyStageChange(pendingStage.lead, pendingStage.stage, extras);
            })}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-100">รายละเอียดสถานะ — {pendingStage.lead.schoolName}</h3>
            {pendingStage.stage === 'DocumentSent' && (
              <label className="block text-xs text-slate-400 font-semibold">
                ช่องทางเอกสาร
                <select value={documentChannel} onChange={e => setDocumentChannel(e.target.value)} className={`${inputClass} mt-1`}>
                  {DOCUMENT_CHANNEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.value === 'SchoolSubmit' ? 'ยื่นหน่วยงาน' : opt.label}</option>)}
                </select>
              </label>
            )}
            {pendingStage.stage === 'Appointed' && (
              <label className="block text-xs text-slate-400 font-semibold">
                ประเภทนัด
                <select value={appointmentKind} onChange={e => setAppointmentKind(e.target.value)} className={`${inputClass} mt-1`}>
                  {APPOINTMENT_KIND_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            )}
            {stageRequiresEventAt(pendingStage.stage) && (
              <label className="block text-xs text-slate-400 font-semibold">
                {getStageEventAtLabel(pendingStage.stage)} (จะลงปฏิทินให้อัตโนมัติ)
                <input type="datetime-local" required value={stageEventAt} onChange={e => setStageEventAt(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingStage(null)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">บันทึก</button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
