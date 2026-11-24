import { useState } from 'react';
import { ExternalLink, Pencil, Save, X } from 'lucide-react';
import { apiJson } from '../lib/api';
import { wrapFormSubmit } from '../hooks/useSaveConfirm';
import { formatProfileValue, isUrl, segmentConfigForLead, type ProfileField } from '../lib/lead-segments';

function shortUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(/\/$/, '');
    const tail = path.split('/').filter(Boolean).pop() || '';
    return tail ? `${parsed.hostname} › ${tail.length > 40 ? `${tail.slice(0, 40)}…` : tail}` : parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Shows the research data imported from Excel (segmentProfile) for corporate / university leads,
 * grouped into the same sections as the source sheets. Text fields are editable in place.
 */
export function SegmentProfilePanel({ lead, onUpdated }: { lead: any; onUpdated: (lead: any) => void }) {
  const config = segmentConfigForLead(lead);
  const profile: Record<string, unknown> = lead?.segmentProfile || {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (config.segment === 'school') return null;

  const knownKeys = new Set(config.sections.flatMap(section => section.fields.map(field => field.key)));
  const extraFields: ProfileField[] = Object.keys(profile)
    .filter(key => !knownKeys.has(key) && profile[key] !== null && profile[key] !== '')
    .map(key => ({ key, label: key }));
  const sections = extraFields.length ? [...config.sections, { title: 'ข้อมูลอื่น ๆ', fields: extraFields }] : config.sections;

  const startEdit = () => {
    const next: Record<string, string> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.kind === 'bool') continue;
        const value = profile[field.key];
        next[field.key] = value === null || value === undefined ? '' : String(value);
      }
    }
    setDraft(next);
    setError('');
    setEditing(true);
  };

  const save = () => {
    const changes: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(draft)) {
      const before = profile[key] === null || profile[key] === undefined ? '' : String(profile[key]);
      if (value === before) continue;
      const field = sections.flatMap(section => section.fields).find(item => item.key === key);
      if (!value.trim()) changes[key] = null;
      else if (field?.kind === 'money' && Number.isFinite(Number(value.replace(/,/g, '')))) changes[key] = Number(value.replace(/,/g, ''));
      else changes[key] = value.trim();
    }
    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }
    setSaving(true);
    apiJson(`/api/leads/${lead._id}`, { segmentProfile: changes }, { method: 'PUT' })
      .then(updated => {
        onUpdated(updated);
        setEditing(false);
      })
      .catch(err => setError(err.message || 'บันทึกไม่สำเร็จ'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="p-6 rounded-2xl glass-panel space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            {config.segment === 'corporate' ? 'ข้อมูลองค์กรจากไฟล์ Corporate Sales Launch' : 'ข้อมูลคณะจากไฟล์ Faculty Orientation Research'}
          </h3>
          {lead.externalRef && <p className="text-[10px] text-slate-500 mt-1">อ้างอิง: {lead.externalRef}</p>}
        </div>
        {!editing ? (
          <button type="button" onClick={startEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800">
            <Pencil size={12} /> แก้ไข
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-400">
              <X size={12} /> ยกเลิก
            </button>
            <button type="button" disabled={saving} onClick={wrapFormSubmit(save) as any} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-[11px] font-semibold text-white disabled:opacity-50">
              <Save size={12} /> บันทึก
            </button>
          </div>
        )}
      </div>
      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      {sections.map(section => {
        const visible = section.fields.filter(field => editing ? field.kind !== 'bool' : formatProfileValue(profile[field.key], field.kind));
        if (!visible.length) return null;
        return (
          <div key={section.title} className="space-y-2">
            <h4 className="text-[11px] font-bold text-indigo-300">{section.title}</h4>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {visible.map(field => {
                const value = profile[field.key];
                const text = formatProfileValue(value, field.kind);
                const long = text.length > 80 || field.key === 'nextTask' || field.key === 'nextAction';
                return (
                  <div key={field.key} className={long ? 'md:col-span-2' : ''}>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">{field.label}</dt>
                    <dd className="text-xs text-slate-200 mt-0.5 whitespace-pre-line break-words">
                      {editing ? (
                        <textarea
                          value={draft[field.key] ?? ''}
                          onChange={e => setDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                          rows={long ? 3 : 1}
                          className="w-full px-2 py-1.5 rounded border border-slate-800 bg-[#090d16] text-xs text-slate-200"
                        />
                      ) : isUrl(value) ? (
                        <a href={String(value)} target="_blank" rel="noreferrer" title={String(value)} className="inline-flex max-w-full items-center gap-1 text-indigo-300 hover:underline">
                          <span className="truncate">{shortUrl(String(value))}</span> <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : (
                        text
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
