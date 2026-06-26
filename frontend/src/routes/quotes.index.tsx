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
  TrendingUp,
  Download
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
                <td className="py-3.5 font-semibold text-slate-200">{quote.quoteNumber}</td>
                <td className="py-3.5 text-slate-300">{getSchoolName(quote.leadId)}</td>
                <td className="py-3.5 text-right font-semibold text-slate-200">{quote.totalAmount.toLocaleString()} ฿</td>
                <td className="py-3.5 text-center text-slate-400">{quote.overallDiscountPercent}%</td>
                <td className="py-3.5 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] border font-bold ${getStatusStyle(quote.status)}`}>
                    {quote.status === 'PendingApproval' ? 'รออนุมัติ' : quote.status === 'Approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                  </span>
                </td>
                <td className="py-3.5 text-center flex items-center justify-center gap-2">
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
    </div>
  );
}
