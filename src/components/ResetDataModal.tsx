import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eraser,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatPeriodLabel } from '../utils/format';

interface ResetDataModalProps {
  isOpen: boolean;
  activeAno: number;
  activeMes: number;
  activeTransactionsCount: number;
  totalTransactionsCount: number;
  banksCount: number;
  onClose: () => void;
  onExportBackup: () => void;
  onClearTransactions: (scope: 'active' | 'all') => void;
  onResetFreshStart: () => void;
}

type ResetMode = 'transactions' | 'fresh';

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  activeAno,
  activeMes,
  activeTransactionsCount,
  totalTransactionsCount,
  banksCount,
  onClose,
  onExportBackup,
  onClearTransactions,
  onResetFreshStart,
}) => {
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [selectedMode, setSelectedMode] = useState<ResetMode>('transactions');
  const [txScope, setTxScope] = useState<'active' | 'all'>('all');
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('choose');
      setSelectedMode('transactions');
      setTxScope('all');
      setBackupDownloaded(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const periodLabel = formatPeriodLabel(activeAno, activeMes);

  const handleBackupClick = () => {
    onExportBackup();
    setBackupDownloaded(true);
  };

  const handleProceedStep2 = (mode: ResetMode) => {
    setSelectedMode(mode);
    setStep('confirm');
  };

  const handleConfirmExecute = () => {
    if (selectedMode === 'transactions') {
      onClearTransactions(txScope);
    } else {
      onResetFreshStart();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-modal-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <RotateCcw
              className="w-5 h-5 text-[var(--accent-gold)] shrink-0"
              aria-hidden="true"
            />
            <h2
              id="reset-modal-title"
              className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)] truncate"
            >
              {step === 'choose'
                ? 'Limpar Lançamentos ou Começar do Zero'
                : 'Confirmar Limpeza dos Dados'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de limpeza de dados"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {step === 'choose' ? (
            <>
              {/* Current Summary + Optional Backup */}
              <div className="rounded-lg border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                  <p className="font-semibold text-[var(--accent-blue)]">
                    Resumo atual armazenado
                  </p>
                  <p className="font-mono-nums">
                    {activeTransactionsCount} lançamentos em {periodLabel} ·{' '}
                    {totalTransactionsCount} no total · {banksCount} instituições
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBackupClick}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--accent-blue-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-xs font-semibold text-[var(--accent-blue)] shrink-0 cursor-pointer"
                >
                  {backupDownloaded ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--semantic-income)]" aria-hidden="true" />
                  ) : (
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {backupDownloaded
                      ? 'Backup JSON salvo'
                      : 'Baixar JSON antes de limpar'}
                  </span>
                </button>
              </div>

              {/* Option 1: Clear Transactions Only */}
              <div className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--bg-surface-alt)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      1. Limpar apenas os Lançamentos (Transações)
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      Apaga as movimentações da aba <strong>Controle</strong>, mas{' '}
                      <strong className="text-[var(--semantic-income)]">
                        mantém intactos
                      </strong>{' '}
                      suas Categorias, Subcategorias, Titulares, Formas de Pagamento e
                      todos os saldos de Bancos &amp; Investimentos.
                    </p>
                  </div>
                  <Eraser
                    className="w-5 h-5 text-[var(--accent-gold)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTxScope('active')}
                    className={`px-3 py-2 rounded-lg border font-medium text-left transition-colors cursor-pointer ${
                      txScope === 'active'
                        ? 'border-[var(--accent-gold-border)] bg-[var(--accent-gold-bg)] text-[var(--text-primary)] font-semibold'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Apenas {periodLabel} ({activeTransactionsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxScope('all')}
                    className={`px-3 py-2 rounded-lg border font-medium text-left transition-colors cursor-pointer ${
                      txScope === 'all'
                        ? 'border-[var(--accent-gold-border)] bg-[var(--accent-gold-bg)] text-[var(--text-primary)] font-semibold'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Todos os períodos ({totalTransactionsCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleProceedStep2('transactions')}
                  className="w-full py-2 px-4 rounded-lg border border-[var(--accent-gold-border)] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] text-[var(--accent-gold-text)] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Selecionar: Limpar apenas Lançamentos
                </button>
              </div>

              {/* Option 2: Modo Amigo / Zero */}
              <div className="rounded-xl border-[1.5px] border-[var(--card-expense-border)] bg-[var(--card-expense-bg)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      2. Zerar Dados para Começar do Zero (Modo Amigo)
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      Ideal para compartilhar ou iniciar um controle limpo: apaga todos
                      os lançamentos e zera os saldos bancários e investimentos para{' '}
                      <strong className="font-mono-nums">R$ 0,00</strong>, mantendo
                      instituições, Categorias, Subcategorias, Titulares e Formas de
                      Pagamento prontos para uso imediato.
                    </p>
                  </div>
                  <RotateCcw
                    className="w-5 h-5 text-[var(--semantic-expense)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleProceedStep2('fresh')}
                  className="w-full py-2 px-4 rounded-lg bg-[var(--semantic-expense)] hover:opacity-90 text-white text-xs sm:text-sm font-semibold transition-opacity cursor-pointer"
                >
                  Selecionar: Zerar Tudo (Modo Amigo)
                </button>
              </div>
            </>
          ) : (
            /* STEP 2: Explicit Confirmation */
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--semantic-expense)]/40 bg-[var(--semantic-expense-bg)] p-4 flex items-start gap-3">
                <AlertTriangle
                  className="w-5 h-5 text-[var(--semantic-expense)] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1.5 text-sm">
                  <p className="font-display font-bold text-[var(--text-primary)]">
                    {selectedMode === 'transactions'
                      ? txScope === 'active'
                        ? `Você vai apagar os ${activeTransactionsCount} lançamentos de ${periodLabel}.`
                        : `Você vai apagar todos os ${totalTransactionsCount} lançamentos de todos os períodos.`
                      : 'Você vai ativar o Modo Amigo / Zero em todo o sistema.'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {selectedMode === 'transactions'
                      ? 'Esta ação remove apenas os lançamentos do Controle. Suas Categorias, Subcategorias, Titulares, Formas de Pagamento e Saldos Bancários serão preservados.'
                      : 'Todos os lançamentos serão apagados e todos os valores de Bancos & Investimentos serão zerados para R$ 0,00. Categorias, Subcategorias, Titulares, Formas de Pagamento e nomes das instituições permanecem prontos para novos lançamentos.'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <ShieldCheck
                    className="w-4 h-4 text-[var(--semantic-income)] shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {backupDownloaded
                      ? 'Backup JSON já foi baixado nesta etapa.'
                      : 'Deseja salvar um arquivo .json de segurança antes de confirmar?'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBackupClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent-blue-border)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--accent-blue)] shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Baixar JSON</span>
                </button>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[var(--border-strong)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExecute}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-[var(--semantic-expense)] hover:opacity-90 text-white text-sm font-semibold transition-opacity cursor-pointer"
                >
                  <Eraser className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {selectedMode === 'transactions'
                      ? 'Confirmar e Limpar Lançamentos'
                      : 'Confirmar e Zerar Dados (Modo Amigo)'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
