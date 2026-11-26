import { useEffect, useState } from 'react';
import { Button } from './Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem('hl:pwa-install-dismissed') ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
      return;
    }

    setIos(isIosDevice());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (isStandalone()) return;
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const showIosPrompt = ios && !deferred && !dismissed && !isStandalone();
  const showInstallPrompt = Boolean(deferred) && !dismissed && !isStandalone();
  if (!showIosPrompt && !showInstallPrompt) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }

  function close() {
    localStorage.setItem('hl:pwa-install-dismissed', String(Date.now()));
    setDismissed(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-stone-200 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">Install HalalLivestock app</p>
          {showIosPrompt ? (
            <p className="mt-0.5 text-sm text-ink-500">
              On iPhone/iPad: tap <span className="font-medium text-ink-700">Share</span>, then <span className="font-medium text-ink-700">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-500">Add it to your phone for quick access to orders, messages, and updates.</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={close}>{showIosPrompt ? 'Got it' : 'Not now'}</Button>
          {showInstallPrompt ? <Button size="sm" onClick={() => void install()}>Install</Button> : null}
        </div>
      </div>
    </div>
  );
}
