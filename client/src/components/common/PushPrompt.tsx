import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { notificationService } from '../../services/notificationService';
import { Button } from './Button';

export function PushPrompt() {
  const { status, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      setVisible(false);
      return;
    }
    const dismissedAt = Number(localStorage.getItem(`hl:push-prompt-dismissed:${user.id}`) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;

    let active = true;
    notificationService.pushStatus()
      .then((s) => {
        if (active && (s === 'default' || s === 'granted')) setVisible(true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [status, user]);

  if (!visible || status !== 'authenticated') return null;

  async function enable() {
    setBusy(true);
    try {
      const result = await notificationService.enablePush();
      if (result === 'enabled' || result === 'denied' || result === 'unconfigured' || result === 'unsupported') {
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (user) localStorage.setItem(`hl:push-prompt-dismissed:${user.id}`, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl bg-brand-900 p-4 text-white shadow-lift ring-1 ring-brand-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">Turn on device notifications</p>
        <p className="mt-0.5 text-sm text-brand-100">Get alerts for new messages, order updates, and admin replies even when the app is closed.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={close}>Later</Button>
        <Button size="sm" onClick={() => void enable()} disabled={busy}>{busy ? 'Enabling...' : 'Enable'}</Button>
      </div>
    </div>
  );
}