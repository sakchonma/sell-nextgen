import { createRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { 
  FileText, 
  Plus, 
  Check, 
  X, 
  AlertCircle, 
  Send,
  TrendingUp,
  Download,
  Eye,
  PenLine
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/quotes',
  component: QuotesIndexComponent,
});

function QuotesIndexComponent() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | 'PendingApproval' | 'Approved' | 'Rejected'>('All');
  
  // Dialog State
  const [rejectQuote, setRejectQuote] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [customerName, setCustomerName] = useState('');

  const fetchQuotesData = () => {
    apiFetch('/api/quotes')
      .then(data => setQuotes(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load quotes:', err));

    apiFetch('/api/leads')
      .then(data => setLeads(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load leads:', err));
  };

  useEffect(() => {
    fetchQuotesData();
  }, [user]);

  const handleApprove = (id: string) => {
    apiJson(`/api/quotes/${id}/approve`, { status: 'Approved' }, { method: 'PUT' })
      .then(() => fetchQuotesData())
      .catch(err => console.error('Failed to approve quote:', err));
  };

  const handleRejectClick = (quote: any) => {
    setRejectQuote(quote);
    setRejectReason('');
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectQuote || !rejectReason.trim()) return;

    apiJson(`/api/quotes/${rejectQuote._id}/approve`, { status: 'Rejected', reason: rejectReason }, { method: 'PUT' })
      .then(() => {
        setRejectQuote(null);
        fetchQuotesData();
      })
      .catch(err => console.error('Failed to reject quote:', err));
  };

  const openQuoteDetail = (quote: any) => {
    apiFetch(`/api/quotes/${quote._id}`)
      .then(data => {
        setSelectedQuote(data);
        setSendEmail(data.sentToEmail || data.lead?.contacts?.find((contact: any) => contact.email)?.email || '');
        setCustomerName(data.acceptedByName || data.lead?.contacts?.[0]?.name || '');
      })
      .catch(err => console.error('Failed to load quote detail:', err));
  };

  const sendQuote = () => {
    if (!selectedQuote) return;
    apiJson(`/api/quotes/${selectedQuote._id}/send`, { customerEmail: sendEmail || undefined }, { method: 'POST' })
      .then(data => {
        setSelectedQuote(data);
        fetchQuotesData();
      })
      .catch(err => alert(err.message));
  };

  const acceptQuote = () => {
    if (!selectedQuote || !customerName.trim()) return;
    apiJson(`/api/quotes/${selectedQuote._id}/accept`, { customerName }, { method: 'POST' })
      .then(data => {
        setSelectedQuote(data);
        fetchQuotesData();
      })
      .catch(err => alert(err.message));
  };

  const convertQuote = () => {
    if (!selectedQuote) return;
    apiJson(`/api/quotes/${selectedQuote._id}/convert-to-opportunity`, {}, { method: 'POST' })
      .then(() => {
        openQuoteDetail(selectedQuote);
        fetchQuotesData();
      })
      .catch(err => alert(err.message));
  };

  const getSchoolName = (leadId: string) => {
    const lead = leads.find(l => l._id === leadId);
    return lead ? lead.schoolName : 'ไม่ระบุโรงเรียน';
  };

  const getStatusStyle = (status: string) => {
    if (status === 'Approved') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    if (status === 'PendingApproval') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
  };

  const filteredQuotes = quotes.filter(q => {
    if (activeTab === 'All') return true;
    return q.status === activeTab;
  });

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <FileText className="text-indigo-400" /> เอกสารใบเสนอราคา
          </h2>
          <p className="text-xs text-slate-400 mt-1">จัดการเอกสารใบเสนอราคาของพนักงานและตรวจสอบคิวรออนุมัติส่วนลด</p>
        </div>
        <Link 
          to="/quotes/build"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
        >
          <Plus size={14} /> สร้างใบเสนอราคา
        </Link>
      </div>

      {/* TABS */}
      <div className="border-b border-slate-800 flex gap-4">
        {[
          { id: 'All', label: 'ทั้งหมด' },
          { id: 'PendingApproval', label: 'รออนุมัติส่วนลด' },
          { id: 'Approved', label: 'อนุมัติแล้ว' },
          { id: 'Rejected', label: 'ปฏิเสธ' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* QUOTES LIST */}
      <div className="p-6 rounded-2xl glass-panel space-y-4 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-widest font-black text-[9.5px]">
              <th className="pb-3 pr-4">รหัสเอกสาร</th>
              <th className="pb-3 pr-4">โรงเรียนลูกค้า</th>
              <th className="pb-3 pr-4 text-right">ยอดรวมสุทธิ</th>
              <th className="pb-3 pr-4 text-center">ส่วนลดพิเศษ</th>
              <th className="pb-3 pr-4 text-center">สถานะ</th>
              <th className="pb-3 text-center">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredQuotes.map(quote => (
              <tr key={quote._id} className="hover:bg-slate-900/10">
                <td className="py-3.5 font-semibold text-slate-200">
                  {quote.quoteNumber}
                  {quote.version > 1 && <span className="ml-1 text-[9px] text-indigo-300">Rev.{quote.version}</span>}
                </td>
                <td className="py-3.5 text-slate-300">{getSchoolName(quote.leadId)}</td>
                <td className="py-3.5 text-right font-semibold text-slate-200">{quote.totalAmount.toLocaleString()} ฿</td>
                <td className="py-3.5 text-center text-slate-400">{quote.overallDiscountPercent}%</td>
                <td className="py-3.5 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] border font-bold ${getStatusStyle(quote.status)}`}>
                    {quote.status === 'PendingApproval' ? 'รออนุมัติ' : quote.status === 'Approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                  </span>
                  {quote.rejectionReason && <div className="mt-1 text-[9px] text-rose-300 line-clamp-1">{quote.rejectionReason}</div>}
                </td>
                <td className="py-3.5 text-center flex items-center justify-center gap-2">
                  <button
                    onClick={() => openQuoteDetail(quote)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="ดูรายละเอียดใบเสนอราคา"
                  >
                    <Eye size={12} />
                  </button>
                  {/* Actions for Manager/Exec on pending quotes */}
                  {quote.status === 'PendingApproval' && user && user.rank >= 4 ? (
                    <>
                      <button 
                        onClick={() => handleApprove(quote._id)}
                        className="p-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 cursor-pointer"
                        title="อนุมัติใบเสนอราคานี้"
                      >
                        <Check size={12} />
                      </button>
                      <button 
                        onClick={() => handleRejectClick(quote)}
                        className="p-1 rounded bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 cursor-pointer"
                        title="ปฏิเสธใบเสนอราคานี้"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => window.open(`/api/quotes/${quote._id}/pdf`, '_blank')}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                      title="ดาวน์โหลด PDF"
                    >
                      <Download size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredQuotes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  ไม่มีเอกสารใบเสนอราคาในกลุ่มนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* REJECT DIALOG FOR QUOTATIONS */}
      {rejectQuote && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRejectSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <AlertCircle className="text-rose-400" /> ปฏิเสธการอนุมัติใบเสนอราคา
            </h3>

            <p className="text-xs text-slate-400">
              ระบุเหตุผลในการปฏิเสธการเสนอส่วนลดใบเสนอราคาโครงการ: <span className="font-semibold text-slate-200">{rejectQuote.quoteNumber}</span>
            </p>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">เหตุผลประกอบการปฏิเสธ</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น ส่วนลดเปอร์เซ็นต์สูงเกินเกณฑ์องค์กร กรุณาปรับไม่เกิน 15%..."
                rows={3}
                className="w-full p-3 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                required
              ></textarea>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button"
                onClick={() => setRejectQuote(null)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                ส่งผลการปฏิเสธ
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedQuote && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <FileText className="text-indigo-400" /> {selectedQuote.quoteNumber} Rev.{selectedQuote.version || 1}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{selectedQuote.lead?.schoolName || getSchoolName(selectedQuote.leadId)} · หมดอายุ {selectedQuote.expiresAt ? new Date(selectedQuote.expiresAt).toLocaleDateString('th-TH') : '-'}</p>
              </div>
              <button onClick={() => setSelectedQuote(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200" title="ปิด">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[10.5px]">
              {[
                ['สถานะอนุมัติ', selectedQuote.status],
                ['Email', selectedQuote.emailStatus || 'Draft'],
                ['Signature', selectedQuote.signatureStatus || 'Pending'],
                ['ยอดสุทธิ', `${Number(selectedQuote.totalAmount || 0).toLocaleString()} ฿`],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg bg-[#090d16]/60 border border-slate-800">
                  <span className="block text-slate-500 mb-1">{label}</span>
                  <span className="font-semibold text-slate-200">{value}</span>
                </div>
              ))}
            </div>

            {selectedQuote.rejectionReason && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                เหตุผลที่ปฏิเสธ: {selectedQuote.rejectionReason}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">ส่งลูกค้า / รับรองเอกสาร</h4>
                <input value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="customer@email.com" className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 outline-none" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={sendQuote} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500">
                    <Send size={13} /> บันทึกสถานะส่งแล้ว
                  </button>
                  <button onClick={() => window.open(`/api/quotes/${selectedQuote._id}/pdf`, '_blank')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                    <Download size={13} /> PDF
                  </button>
                </div>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="ชื่อผู้ยอมรับใบเสนอราคา" className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 outline-none" />
                <button onClick={acceptQuote} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500">
                  <PenLine size={13} /> บันทึกลูกค้ายอมรับ
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">เงื่อนไขและการปิดการขาย</h4>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{selectedQuote.terms || '-'}</p>
                <button disabled={Boolean(selectedQuote.convertedOpportunityId)} onClick={convertQuote} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  <TrendingUp size={13} /> {selectedQuote.convertedOpportunityId ? 'แปลงเป็น Won แล้ว' : 'แปลงเป็น Won Opportunity'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4 overflow-x-auto">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">รายการสินค้า</h4>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-800">
                  {(selectedQuote.items || []).map((item: any, idx: number) => (
                    <tr key={`${item.productId || item.name}-${idx}`}>
                      <td className="py-2 text-slate-200">{item.name}</td>
                      <td className="py-2 text-right text-slate-400">{item.quantity} x {Number(item.price || 0).toLocaleString()} ฿</td>
                      <td className="py-2 text-right text-slate-400">{item.discountPercent || 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-[10.5px] text-slate-400">
              <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Approval trail</h4>
                {(selectedQuote.approvalTrail || []).length === 0 && <div className="text-slate-600">ยังไม่มีประวัติอนุมัติ</div>}
                {(selectedQuote.approvalTrail || []).map((item: any, idx: number) => (
                  <div key={idx} className="py-1">{item.status} · {item.actorName || item.actorId} · {new Date(item.decidedAt).toLocaleString('th-TH')} {item.reason ? `· ${item.reason}` : ''}</div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Revision history</h4>
                {(selectedQuote.revisions || []).length === 0 && <div className="text-slate-600">ยังไม่มี revision</div>}
                {(selectedQuote.revisions || []).map((item: any, idx: number) => (
                  <div key={idx} className="py-1">Rev.{item.version} · {new Date(item.changedAt).toLocaleString('th-TH')} {item.reason ? `· ${item.reason}` : ''}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
