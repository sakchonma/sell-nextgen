import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, FileText, Plus, Trash2 } from 'lucide-react';
import { calculateQuoteTotals, formatMoney, getUserDiscountLimit } from '../lib/quoteMath';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/quotes/build',
  component: QuoteBuilderComponent,
});

function QuoteBuilderComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [discountSettings, setDiscountSettings] = useState<any>({ roleLimits: [], individualLimits: [] });
  const [leadId, setLeadId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [vatPercent, setVatPercent] = useState(7);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
        if (!leadId && normalizedLeads[0]) setLeadId(normalizedLeads[0]._id);
      })
      .catch(err => {
        console.error('Failed to load quote builder data:', err);
        setError('โหลดข้อมูลสำหรับสร้างใบเสนอราคาไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const userDiscountLimit = useMemo(() => {
    return getUserDiscountLimit(discountSettings, user);
  }, [discountSettings, user]);

  const totals = useMemo(() => {
    return calculateQuoteTotals(items, overallDiscountPercent, vatPercent);
  }, [items, overallDiscountPercent, vatPercent]);

  const isOverLimit = Number(overallDiscountPercent || 0) > userDiscountLimit;

  const addProduct = (product: any) => {
    setItems(prev => {
      const found = prev.find(item => item.productId === product._id);
      if (found) {
        return prev.map(item => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          price: Number(product.price || 0),
          quantity: 1,
          discountPercent: 0,
        },
      ];
    });
  };

  const updateItem = (productId: string, patch: any) => {
    setItems(prev => prev.map(item => item.productId === productId ? { ...item, ...patch } : item));
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(item => item.productId !== productId));
  };

  const submitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!leadId || items.length === 0) {
      setError('กรุณาเลือกโรงเรียนและเพิ่มสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    apiJson('/api/quotes', {
        leadId,
        items,
        overallDiscountPercent,
        vatPercent,
        totalAmount: totals.total,
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

      <form onSubmit={submitQuote} className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">โรงเรียนลูกค้า</label>
              <select value={leadId} onChange={e => setLeadId(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" required>
                {leads.map(lead => (
                  <option key={lead._id} value={lead._id}>{lead.schoolName} · {lead.zone}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {products.map(product => (
                <button
                  type="button"
                  key={product._id}
                  onClick={() => addProduct(product)}
                  className="p-3 rounded-lg border border-slate-800 bg-[#090d16]/40 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-left transition-all"
                >
                  <div className="text-xs font-semibold text-slate-200 line-clamp-2">{product.name}</div>
                  <div className="flex items-center justify-between mt-2 text-[10px]">
                    <span className="text-slate-500">{product.category}</span>
                    <span className="text-indigo-300 font-bold">{Number(product.price || 0).toLocaleString('th-TH')} ฿</span>
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
                  <th className="px-4 py-3 text-right">ราคา</th>
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
                    <tr key={item.productId}>
                      <td className="px-4 py-3 font-semibold text-slate-200">{item.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{formatMoney(item.price)} ฿</td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min={1} value={item.quantity} onChange={e => updateItem(item.productId, { quantity: Number(e.target.value) })} className="w-16 px-2 py-1.5 rounded border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-center focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min={0} max={100} value={item.discountPercent} onChange={e => updateItem(item.productId, { discountPercent: Number(e.target.value) })} className="w-16 px-2 py-1.5 rounded border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-center focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-200">{formatMoney(lineTotal)} ฿</td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => removeItem(item.productId)} className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" title="ลบรายการ">
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
              <input type="number" min={0} max={100} value={overallDiscountPercent} onChange={e => setOverallDiscountPercent(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">VAT</label>
              <input type="number" min={0} max={100} value={vatPercent} onChange={e => setVatPercent(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-500" />
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
    </div>
  );
}
