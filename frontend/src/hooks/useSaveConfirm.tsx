import { useEffect, useState, type ReactNode } from 'react';
import { ModalShell } from '../components/ui';

type SaveConfirmOptions = {
  title?: string;
  message?: string;
};

type PendingSave = {
  action: () => void | Promise<void>;
  title: string;
  message: string;
};

let openSaveConfirm: ((pending: PendingSave) => void) | null = null;

export function requestSaveConfirm(
  action: () => void | Promise<void>,
  options?: SaveConfirmOptions
) {
  const payload: PendingSave = {
    action,
    title: options?.title ?? 'ยืนยันการบันทึก',
    message: options?.message ?? 'ต้องการบันทึกข้อมูลนี้หรือไม่?',
  };
  if (openSaveConfirm) {
    openSaveConfirm(payload);
    return;
  }
  void action();
}

export function wrapFormSubmit(
  handler: (e: React.FormEvent) => void | Promise<void>,
  options?: SaveConfirmOptions
) {
  return (e: React.FormEvent) => {
    e.preventDefault();
    requestSaveConfirm(() => handler(e), options);
  };
}

export function SaveConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingSave | null>(null);

  useEffect(() => {
    openSaveConfirm = (next: PendingSave) => {
      setPending(next);
      setOpen(true);
    };
    return () => {
      openSaveConfirm = null;
    };
  }, []);

  const handleCancel = () => {
    setOpen(false);
    setPending(null);
  };

  const handleConfirm = async () => {
    if (pending) await pending.action();
    handleCancel();
  };

  return (
    <>
      {children}
      {open && pending && (
        <ModalShell>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">{pending.title}</h3>
            <p className="text-sm text-slate-400">{pending.message}</p>
            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                ยืนยันบันทึก
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
