import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Instalar aplicativo no dispositivo"
        title="Instalar aplicativo (PWA)"
        className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] hover:opacity-90 text-[var(--accent-blue)] text-xs sm:text-sm font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-underline)]"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline 2xl:hidden">Instalar</span>
        <span className="hidden 2xl:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Como instalar no iPhone ou iPad"
          title="Instalar no iOS"
          className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] hover:opacity-90 text-[var(--accent-blue)] text-xs sm:text-sm font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-underline)]"
        >
          <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="hidden xl:inline 2xl:hidden">Instalar</span>
          <span className="hidden 2xl:inline">Instalar App</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-modal-backdrop)] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-xl border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="ios-install-title"
                  className="font-display text-base font-bold text-[var(--text-primary)]"
                >
                  Instalar no iPhone / iPad
                </h2>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar instruções de instalação"
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="text-sm text-[var(--text-secondary)] space-y-1.5 list-decimal list-inside">
                <li>
                  Toque no botão <strong>Compartilhar</strong> na barra do Safari.
                </li>
                <li>
                  Role para baixo e toque em{' '}
                  <strong>Adicionar à Tela de Início</strong>.
                </li>
                <li>
                  Confirme em <strong>Adicionar</strong> para abrir em tela cheia.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] text-sm font-semibold cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
