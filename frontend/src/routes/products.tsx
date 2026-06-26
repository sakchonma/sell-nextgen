import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { Edit2, Package, Plus, Search, Trash2, X } from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/products',
  component: ProductsComponent,
});

const emptyProduct = {
  _id: '',
  name: '',
  category: 'Coding',
  price: 0,
  description: '',
  specialOffers: '',
  isActive: true,
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function ProductsComponent() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [error, setError] = useState('');

  const canManage = (user?.rank || 0) >= 4;

  const fetchProducts = () => {
    const params = new URLSearchParams({ search, category, limit: '100' });
    fetch(`/api/products?${params.toString()}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data.data) ? data.data : []))
      .catch(err => {
        console.error('Failed to load products:', err);
        setError('โหลดข้อมูลสินค้าไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchProducts();
  }, [search, category]);

  const categories = useMemo(() => {
    const values = products.map(p => p.category).filter(Boolean);
    return ['All', ...Array.from(new Set(['Coding', 'Hardware', 'Software', 'Service', ...values]))];
  }, [products]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setError('');
    setShowModal(true);
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setForm({ ...emptyProduct, ...product });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setError('');
    setShowModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const isEditing = Boolean(editingProduct?._id);
    fetch(isEditing ? `/api/products/${editingProduct._id}` : '/api/products', {
      method: isEditing ? 'PUT' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify(form),
    })
      .then(async res => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'บันทึกสินค้าไม่สำเร็จ');
        }
        return res.json();
      })
      .then(() => {
        closeModal();
        fetchProducts();
      })
      .catch(err => setError(err.message));
  };

  const handleDelete = (id: string) => {
    if (!canManage || !window.confirm('ยืนยันการลบสินค้านี้?')) return;

    fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(async res => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'ลบสินค้าไม่สำเร็จ');
        }
        fetchProducts();
      })
      .catch(err => setError(err.message));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Package className="text-indigo-400" /> สินค้า & ราคา
          </h2>
          <p className="text-xs text-slate-400 mt-1">จัดการรายการสินค้า หมวดหมู่ ราคา และข้อเสนอพิเศษสำหรับใบเสนอราคา</p>
        </div>

        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
          >
            <Plus size={14} /> เพิ่มสินค้า
          </button>
        )}
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หรือคำอธิบาย..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none"
        >
          {categories.map(item => (
            <option key={item} value={item}>{item === 'All' ? 'ทุกหมวดหมู่' : item}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-[#121826]/40 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-widest font-black text-[9.5px]">
              <th className="px-4 py-3">สินค้า</th>
              <th className="px-4 py-3">หมวดหมู่</th>
              <th className="px-4 py-3 text-right">ราคา</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              {canManage && <th className="px-4 py-3 text-center">จัดการ</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {products.map(product => (
              <tr key={product._id} className="hover:bg-slate-900/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-200">{product.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 max-w-xl truncate">{product.description || product.specialOffers || '-'}</div>
                </td>
                <td className="px-4 py-3 text-slate-400">{product.category}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-200">{Number(product.price || 0).toLocaleString('th-TH')} ฿</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[9px] border font-bold ${product.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    {product.isActive ? 'เปิดขาย' : 'ปิดใช้'}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(product)} className="p-1.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20" title="แก้ไขสินค้า">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(product._id)} className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" title="ลบสินค้า">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-12 text-center text-slate-500">ไม่มีสินค้าในเงื่อนไขนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && canManage && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
              <button type="button" onClick={closeModal} className="text-slate-500 hover:text-slate-200" title="ปิด">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 font-semibold mb-1">ชื่อสินค้า</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">หมวดหมู่</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">ราคา</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 font-semibold mb-1">คำอธิบาย</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 font-semibold mb-1">ข้อเสนอพิเศษ</label>
                <input value={form.specialOffers} onChange={e => setForm({ ...form, specialOffers: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
              </div>
              <label className="md:col-span-2 flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="accent-indigo-500" />
                เปิดให้เลือกในใบเสนอราคา
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg">บันทึกสินค้า</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
