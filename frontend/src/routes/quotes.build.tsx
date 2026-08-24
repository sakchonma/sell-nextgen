import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, FileText, Plus, Search, Trash2, X } from 'lucide-react';
import { calculateQuoteTotals, formatMoney, getUserDiscountLimit } from '../lib/quoteMath';
import { apiFetch, apiJson } from '../lib/api';
import { wrapFormSubmit } from '../hooks/useSaveConfirm';
import { filterLeadsBySearch } from '../lib/lead-search';
import { NumericInput } from '../components/numeric-input';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/quotes/build',
  component: QuoteBuilderComponent,
});

type QuoteLine = {
  lineId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  discountPercent: number;
  priceMode?: string;
  subtitle?: string;
  packageLabel?: string;
  gradeLevels?: string;
  productCategory?: string;
  description?: string;
};

const DEFAULT_ACADEMIC_YEAR = new Date().getFullYear() + 543;

function buildCleverSubtitle(packageLabel: string, academicYear: number) {
  if (packageLabel.includes('ภาคเรียน')) {
    return `ระยะเวลาการใช้งาน: 1 ภาคเรียน ปีการศึกษา ${academicYear}`;
  }
  return `ระยะเวลาการใช้งาน: 1 ปีการศึกษา ${academicYear}`;
}

function QuoteBuilderComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [discountSettings, setDiscountSettings] = useState<any>({ roleLimits: [], individualLimits: [] });
  const [leadId, setLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [items, setItems] = useState<QuoteLine[]>([]);
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [vatPercent, setVatPercent] = useState(7);
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  });
  const [terms, setTerms] = useState('ราคานี้มีผลภายในวันหมดอายุที่ระบุ และยังไม่รวมค่าใช้จ่ายนอกเหนือขอบเขตงานที่ตกลง');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [cleverProduct, setCleverProduct] = useState<any>(null);
  const [cleverPackageId, setCleverPackageId] = useState('');
  const [cleverSubject, setCleverSubject] = useState('Clever Math');
  const [cleverAcademicYear, setCleverAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [cleverGradeLevels, setCleverGradeLevels] = useState('');
  const [cleverUsers, setCleverUsers] = useState(1);
  const [cleverUnitPrice, setCleverUnitPrice] = useState(0);
  const [cleverDiscount, setCleverDiscount] = useState(0);

  const [vrSoftwareProduct, setVrSoftwareProduct] = useState<any>(null);
  const [vrTier, setVrTier] = useState<'standard' | 'promotion'>('standard');
  const [vrUsers, setVrUsers] = useState(1);

  const [vrHardwareProduct, setVrHardwareProduct] = useState<any>(null);
  const [vrHwMode, setVrHwMode] = useState<'purchase' | 'rental'>('purchase');
  const [vrHwOptionId, setVrHwOptionId] = useState('');
  const [vrHwQty, setVrHwQty] = useState(1);

  const fetchData = () => {
    Promise.all([
      apiFetch('/api/leads'),
      apiFetch('/api/products?limit=100'),
      apiFetch('/api/discount-settings').catch(() => ({ roleLimits: [], individualLimits: [] })),
    ])
      .then(([leadData, productData, settingData]) => {
        const normalizedLeads = Array.isArray(leadData) ? leadData : [];
        const normalizedProducts = Array.isArray(productData.data) ? productData.data.filter((product: any) => product.isActive !== false) : [];
        setLeads(normalizedLeads);
        setProducts(normalizedProducts);
        setDiscountSettings(settingData);
      })
      .catch(err => {
        console.error('Failed to load quote builder data:', err);
        setError('โหลดข้อมูลสำหรับสร้างใบเสนอราคาไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLeads = useMemo(
    () => filterLeadsBySearch(leads, leadSearch),
    [leads, leadSearch]
  );

  const selectLead = (lead: { _id: string; schoolName: string; gradeLevels?: string } | null) => {
    if (!lead) {
      setLeadId('');
      setLeadSearch('');
      setCleverGradeLevels('');
    } else {
      setLeadId(lead._id);
      setLeadSearch(lead.schoolName);
      setCleverGradeLevels(lead.gradeLevels || '');
    }
    setShowLeadDropdown(false);
  };

  const userDiscountLimit = useMemo(() => {
    return getUserDiscountLimit(discountSettings, user);
  }, [discountSettings, user]);

  const totals = useMemo(() => {
    return calculateQuoteTotals(items, overallDiscountPercent, vatPercent);
  }, [items, overallDiscountPercent, vatPercent]);

  const isOverLimit = Number(overallDiscountPercent || 0) > userDiscountLimit;

  const newLineId = () => `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const addLine = (line: Omit<QuoteLine, 'lineId'>) => {
    setItems(prev => [...prev, { ...line, lineId: newLineId() }]);
  };

  const addGenericProduct = (product: any) => {
    const existing = items.find(item => item.productId === product._id && item.priceMode !== 'manual');
    if (existing) {
      setItems(prev => prev.map(item =>
        item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item
      ));
      return;
    }
    addLine({
      productId: product._id,
      name: product.name,
      price: Number(product.price || 0),
      quantity: 1,
      discountPercent: 0,
      priceMode: product.priceMode || 'fixed',
    });
  };

  const handleProductClick = (product: any) => {
    if (product.productCategory === 'clever_exercise') {
      setCleverProduct(product);
      setCleverPackageId(product.packages?.[0]?.id || '');
      setCleverSubject('Clever Math');
      setCleverAcademicYear(DEFAULT_ACADEMIC_YEAR);
      setCleverUsers(1);
      setCleverUnitPrice(0);
      setCleverDiscount(0);
      return;
    }
    if (product.productCategory === 'vr_software') {
      setVrSoftwareProduct(product);
      setVrTier('standard');
      setVrUsers(1);
      return;
    }
    if (product.hardwareOptions?.length) {
      setVrHardwareProduct(product);
      setVrHwMode('purchase');
      setVrHwOptionId(product.hardwareOptions[0]?.id || '');
      setVrHwQty(1);
      return;
    }
    addGenericProduct(product);
  };

  const confirmCleverLine = () => {
    if (!cleverProduct) return;
    const pkg = cleverProduct.packages?.find((p: any) => p.id === cleverPackageId);
    const unitPrice = Number(cleverUnitPrice) || 0;
    if (unitPrice <= 0) {
      setError('กรุณากรอกราคาต่อ User สำหรับ Clever Exercise');
      return;
    }
    const packageLabel = pkg?.label || 'Package';
    const gradeLine = cleverGradeLevels.trim();
    addLine({
      productId: cleverProduct._id,
      name: `${cleverSubject} License`,
      subtitle: buildCleverSubtitle(packageLabel, Number(cleverAcademicYear) || DEFAULT_ACADEMIC_YEAR),
      packageLabel,
      gradeLevels: gradeLine ? `นักเรียนระดับชั้น ${gradeLine}` : '',
      productCategory: 'clever_exercise',
      price: unitPrice,
      quantity: Number(cleverUsers) || 1,
      discountPercent: Number(cleverDiscount) || 0,
      priceMode: 'manual',
    });
    setCleverProduct(null);
    setError('');
  };

  const confirmVrSoftwareLine = () => {
    if (!vrSoftwareProduct) return;
    const tiers = vrSoftwareProduct.priceTiers || { standard: 1500, promotion: 750 };
    const unitPrice = vrTier === 'promotion' ? Number(tiers.promotion) : Number(tiers.standard);
    addLine({
      productId: vrSoftwareProduct._id,
      name: `${vrSoftwareProduct.name} — ${vrTier === 'promotion' ? 'Promotion' : 'Standard'} · ${vrUsers} users`,
      price: unitPrice,
      quantity: Number(vrUsers) || 1,
      discountPercent: 0,
      priceMode: 'tiered',
    });
    setVrSoftwareProduct(null);
  };

  const confirmVrHardwareLine = () => {
    if (!vrHardwareProduct) return;
    const opt = vrHardwareProduct.hardwareOptions?.find((o: any) => o.id === vrHwOptionId);
    if (!opt) return;
    const unitPrice = vrHwMode === 'rental' ? Number(opt.rentalPricePerYear) : Number(opt.purchasePrice);
    addLine({
      productId: vrHardwareProduct._id,
      name: `${vrHardwareProduct.name} — ${opt.label} (${vrHwMode === 'rental' ? 'เช่า/ปี' : 'ซื้อขาด'})`,
      price: unitPrice,
      quantity: Number(vrHwQty) || 1,
      discountPercent: 0,
      priceMode: 'fixed',
    });
    setVrHardwareProduct(null);
  };

  const updateItem = (lineId: string, patch: Partial<QuoteLine>) => {
    setItems(prev => prev.map(item => item.lineId === lineId ? { ...item, ...patch } : item));
  };

  const removeItem = (lineId: string) => {
    setItems(prev => prev.filter(item => item.lineId !== lineId));
  };

  const canEditUnitPrice = (item: QuoteLine) => item.priceMode === 'manual';

  const submitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!leadId || items.length === 0) {
      if (!leadId) {
        setError(leadSearch.trim() ? 'กรุณาเลือกโรงเรียนจากรายการที่ค้นหา' : 'กรุณาเลือกโรงเรียน');
      } else {
        setError('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
      }
      return;
    }

    const payloadItems = items.map(({ lineId, priceMode, ...rest }) => rest);

    apiJson('/api/quotes', {
        leadId,
        items: payloadItems,
        overallDiscountPercent,
        vatPercent,
        totalAmount: totals.total,
        expiresAt,
        terms,
      })
      .then(data => {
        setMessage(data.status === 'PendingApproval' ? 'สร้างใบเสนอราคาแล้วและส่งเข้าคิวอนุมัติส่วนลด' : 'สร้างใบเสนอราคาและอนุมัติอัตโนมัติแล้ว');
        setTimeout(() => navigate({ to: '/quotes' }), 900);
      })
      .catch(err => setError(err.message));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/quotes" className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 mb-2">
            <ArrowLeft size={12} /> กลับไปหน้ารายการใบเสนอราคา
          </Link>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <FileText className="text-indigo-400" /> สร้างใบเสนอราคา
          </h2>
          <p className="text-xs text-slate-400 mt-1">เลือกสินค้า คำนวณส่วนลด ภาษี และส่งอนุมัติตามเกณฑ์อัตโนมัติ</p>
        </div>
        <div className={`px-3 py-2 rounded-lg border text-xs font-semibold ${isOverLimit ? 'bg-amber-500/10 text-amber-300 border-amber-500/25' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'}`}>
          เพดานส่วนลดของคุณ: {userDiscountLimit}%
        </div>
      </div>

      {message && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2"><CheckCircle2 size={14} /> {message}</div>}
      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <form onSubmit={wrapFormSubmit(submitQuote)} className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4 space-y-4">
            <div className="relative">
              <label className="block text-xs text-slate-400 font-semibold mb-1">โรงเรียนลูกค้า</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => {
                    setLeadSearch(e.target.value);
                    setLeadId('');
                    setShowLeadDropdown(true);
                  }}
                  onFocus={() => setShowLeadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowLeadDropdown(false), 150)}
                  placeholder="พิมพ์ชื่อโรงเรียนเพื่อค้นหา..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  autoComplete="off"
                />
              </div>
              {leadId && (
                <p className="mt-1 text-[10px] text-emerald-400">เลือกแล้ว — กดในช่องเพื่อเปลี่ยนโรงเรียน</p>
              )}
              {showLeadDropdown && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-[#090d16] shadow-xl">
                  {filteredLeads.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">ไม่พบโรงเรียนที่ตรงกับ &quot;{leadSearch.trim()}&quot;</div>
                  ) : (
                    <>
                      {leadSearch.trim() && (
                        <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-slate-800/80">
                          แสดง {filteredLeads.length} รายการที่ใกล้เคียงที่สุด
                        </div>
                      )}
                      {filteredLeads.map(lead => (
                        <button
                          key={lead._id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => selectLead(lead)}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-800 ${leadId === lead._id ? 'bg-indigo-500/10 text-indigo-200' : 'text-slate-200'}`}
                        >
                          <span className="font-medium">{lead.schoolName}</span>
                          {lead.zone && <span className="text-slate-500"> · {lead.zone}</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {products.map(product => (
                <button
                  type="button"
                  key={product._id}
                  onClick={() => handleProductClick(product)}
                  className="p-3 rounded-lg border border-slate-800 bg-[#090d16]/40 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-left transition-all"
                >
                  <div className="text-xs font-semibold text-slate-200 line-clamp-2">{product.name}</div>
                  <div className="flex items-center justify-between mt-2 text-[10px]">
                    <span className="text-slate-500">{product.category}</span>
                    <span className="text-indigo-300 font-bold">
                      {product.priceMode === 'manual' ? 'กรอกราคา' : `${Number(product.price || 0).toLocaleString('th-TH')} ฿`}
                    </span>
                  </div>
                </button>
              ))}
              {products.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs">ยังไม่มีสินค้าที่เปิดใช้งาน</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#121826]/40 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-widest font-black text-[9.5px]">
                  <th className="px-4 py-3">สินค้า</th>
                  <th className="px-4 py-3 text-right">ราคาต่อหน่วย</th>
                  <th className="px-4 py-3 text-center">จำนวน</th>
                  <th className="px-4 py-3 text-center">ส่วนลด</th>
                  <th className="px-4 py-3 text-right">รวม</th>
                  <th className="px-4 py-3 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {items.map(item => {
                  const lineGross = Number(item.price || 0) * Number(item.quantity || 0);
                  const lineTotal = lineGross - lineGross * (Number(item.discountPercent || 0) / 100);
                  return (
                    <tr key={item.lineId}>
                      <td className="px-4 py-3 font-semibold text-slate-200">{item.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {canEditUnitPrice(item) ? (
                          <NumericInput
                            allowDecimal
                            min={0}
                            value={item.price}
                            onChange={price => updateItem(item.lineId, { price })}
                            className="w-24 px-2 py-1.5 rounded border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none"
                          />
                        ) : (
                          <span>{formatMoney(item.price)} ฿</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <NumericInput min={1} value={item.quantity} onChange={quantity => updateItem(item.lineId, { quantity })} className="w-16 px-2 py-1.5 rounded border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-center focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <NumericInput min={0} max={100} value={item.discountPercent} onChange={discountPercent => updateItem(item.lineId, { discountPercent })} className="w-16 px-2 py-1.5 rounded border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-center focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-200">{formatMoney(lineTotal)} ฿</td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => removeItem(item.lineId)} className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" title="ลบรายการ">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">ยังไม่มีสินค้าในใบเสนอราคา</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-5 sticky top-24">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-indigo-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">สรุปยอด</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">ส่วนลดท้ายบิล</label>
              <NumericInput min={0} max={100} value={overallDiscountPercent} onChange={setOverallDiscountPercent} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">VAT</label>
              <NumericInput allowDecimal min={0} max={100} value={vatPercent} onChange={setVatPercent} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">วันหมดอายุใบเสนอราคา</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Terms & Conditions</label>
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          {isOverLimit && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>ส่วนลดท้ายบิลเกินลิมิต ระบบจะส่งใบเสนอราคาเข้าคิวอนุมัติ</span>
            </div>
          )}

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400"><span>ราคาก่อนส่วนลด</span><span>{formatMoney(totals.gross)} ฿</span></div>
            <div className="flex justify-between text-slate-400"><span>ส่วนลดรายชิ้น</span><span>- {formatMoney(totals.lineDiscount)} ฿</span></div>
            <div className="flex justify-between text-slate-400"><span>ส่วนลดท้ายบิล</span><span>- {formatMoney(totals.overallDiscount)} ฿</span></div>
            <div className="flex justify-between text-slate-400"><span>VAT</span><span>{formatMoney(totals.vat)} ฿</span></div>
            <div className="pt-3 mt-3 border-t border-slate-800 flex justify-between text-sm font-black text-slate-100"><span>ยอดสุทธิ</span><span>{formatMoney(totals.total)} ฿</span></div>
          </div>

          <button type="submit" className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all">
            <Plus size={14} /> สร้างใบเสนอราคา
          </button>
        </aside>
      </form>

      {cleverProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-100">Clever Exercise</h3>
              <button type="button" onClick={() => setCleverProduct(null)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>
            <select value={cleverSubject} onChange={e => setCleverSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              <option value="Clever Math">Clever Math</option>
              <option value="Clever English">Clever English</option>
              <option value="Clever Math + Clever English">Clever Math + Clever English</option>
            </select>
            <select value={cleverPackageId} onChange={e => setCleverPackageId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              {(cleverProduct.packages || []).map((pkg: any) => (
                <option key={pkg.id} value={pkg.id}>{pkg.label}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">ปีการศึกษา</label>
                <NumericInput min={2500} value={cleverAcademicYear} onChange={setCleverAcademicYear} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">ระดับชั้นนักเรียน</label>
                <input type="text" value={cleverGradeLevels} onChange={e => setCleverGradeLevels(e.target.value)} placeholder="เช่น ประถมศึกษาปีที่ 4 - 6" className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">จำนวน User</label>
                <NumericInput min={1} value={cleverUsers} onChange={setCleverUsers} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">ราคาต่อ User (บาท)</label>
                <NumericInput allowDecimal min={0} value={cleverUnitPrice} onChange={setCleverUnitPrice} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">ส่วนลด (%)</label>
              <NumericInput min={0} max={100} value={cleverDiscount} onChange={setCleverDiscount} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            </div>
            <p className="text-[10px] text-slate-500">มูลค่ารวม = จำนวน User × ราคาต่อ User (หักส่วนลดตามที่กำหนด)</p>
            <button type="button" onClick={confirmCleverLine} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">เพิ่มรายการ</button>
          </div>
        </div>
      )}

      {vrSoftwareProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-100">VR Science Lab — Software</h3>
              <button type="button" onClick={() => setVrSoftwareProduct(null)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>
            <select value={vrTier} onChange={e => setVrTier(e.target.value as 'standard' | 'promotion')} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              <option value="standard">Standard — {vrSoftwareProduct.priceTiers?.standard || 1500} บาท/คน/ปี</option>
              <option value="promotion">Promotion — {vrSoftwareProduct.priceTiers?.promotion || 750} บาท/คน/ปี</option>
            </select>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">จำนวน User</label>
              <NumericInput min={1} value={vrUsers} onChange={setVrUsers} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            </div>
            <button type="button" onClick={confirmVrSoftwareLine} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">เพิ่มรายการ</button>
          </div>
        </div>
      )}

      {vrHardwareProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-100">VR Science Lab — Hardware</h3>
              <button type="button" onClick={() => setVrHardwareProduct(null)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>
            <select value={vrHwMode} onChange={e => setVrHwMode(e.target.value as 'purchase' | 'rental')} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              <option value="purchase">ซื้อขาด</option>
              <option value="rental">เช่า (ต่อปี)</option>
            </select>
            <select value={vrHwOptionId} onChange={e => setVrHwOptionId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              {(vrHardwareProduct.hardwareOptions || []).map((opt: any) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">จำนวน</label>
              <NumericInput min={1} value={vrHwQty} onChange={setVrHwQty} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            </div>
            <button type="button" onClick={confirmVrHardwareLine} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">เพิ่มรายการ</button>
          </div>
        </div>
      )}
    </div>
  );
}
