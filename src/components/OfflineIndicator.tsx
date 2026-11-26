import React, { useEffect, useState } from 'react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-[var(--card-gold-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
    >
      <span
        className="h-2 w-2 rounded-full bg-[var(--accent-gold)] animate-pulse"
        aria-hidden="true"
      />
      <span>Modo Offline — Seus dados continuam salvos localmente</span>
    </div>
  );
};
