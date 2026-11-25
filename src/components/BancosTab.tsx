import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Building2, Plus, Trash2, TrendingUp, X } from 'lucide-react';
import type {
  BankAccount,
  PeriodSnapshot,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  computeBankHistory,
  computeBankMetrics,
  computeConsolidatedBanks,
} from '../utils/calculations';
import {
  formatBRL,
  formatPeriodLabel,
  getDefaultDateForPeriod,
  getPeriodKey,
  MONTH_ABBR,
} from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface BancosTabProps {
  ano: number;
  mes: number;
  banks: BankAccount[];
  periods: Record<string, PeriodSnapshot>;
  titulares: string[];
  onAddBank: (nome: string) => void;
  onUpdateBank: (id: string, patch: Partial<BankAccount>) => void;
  onDeleteBank: (id: string) => void;
  onSyncToControle: (tx: Omit<Transaction, 'id'>) => void;
}

export const BancosTab: React.FC<BancosTabProps> = ({
  ano,
  mes,
  banks,
  periods,
  titulares,
  onAddBank,
  onUpdateBank,
  onDeleteBank,
  onSyncToControle,
}) => {
  const [newBankName, setNewBankName] = useState('');
  const [syncBank, setSyncBank] = useState<BankAccount | null>(null);
  const [syncMode, setSyncMode] = useState<'RENDIMENTO' | 'APORTE'>('RENDIMENTO');
  const [syncValue, setSyncValue] = useState(0);
  const [syncTitular, setSyncTitular] = useState(titulares[0] || 'ezequiel');
  const [syncObs, setSyncObs] = useState('');
  const [hoveredPeriodKey, setHoveredPeriodKey] = useState<string | null>(null);

  const consolidated = useMemo(() => computeConsolidatedBanks(banks), [banks]);
  const bankHistory = useMemo(() => computeBankHistory(periods), [periods]);
  const activeKey = getPeriodKey(ano, mes);
  const activePoint =
    bankHistory.find((p) => p.periodoKey === (hoveredPeriodKey || activeKey)) ||
    bankHistory[bankHistory.length - 1] ||
    null;

  const handleCreateBank = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBankName.trim();
    if (!trimmed) return;
    onAddBank(trimmed);
    setNewBankName('');
  };

  const openSyncModal = (bank: BankAccount) => {
    setSyncBank(bank);
    const hasDiv = (bank.dividendosRecebidos || 0) > 0;
    setSyncMode(hasDiv ? 'RENDIMENTO' : 'APORTE');
    setSyncValue(hasDiv ? bank.dividendosRecebidos : 0);
    setSyncTitular(titulares[0] || 'ezequiel');
    setSyncObs(
      hasDiv
        ? `Dividendos/rendimentos ${bank.nome}`
        : `Aporte em investimentos ${bank.nome}`,
    );
  };

  const handleConfirmSync = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncBank || syncValue <= 0) return;

    const tipo: TransactionType = syncMode === 'RENDIMENTO' ? 'RECEITA' : 'DESPESA';
    const categoria = syncMode === 'RENDIMENTO' ? 'RECEITAS' : 'INVESTIMENTOS';
    const descricao =
      syncMode === 'RENDIMENTO' ? 'Investimentos' : 'Aporte Renda Fixa';

    onSyncToControle({
      data: getDefaultDateForPeriod(ano, mes, new Date().getDate()),
      mes,
      ano,
      tipo,
      categoria,
      descricao,
      valor: syncValue,
      obs: syncObs.trim() || `${syncMode} - ${syncBank.nome}`,
      formaPagamento: syncMode === 'RENDIMENTO' ? 'PIXR' : 'PIXD',
      titular: syncTitular,
    });
    setSyncBank(null);
  };

  return (
    <section aria-label="Bancos e Investimentos" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Bancos &amp; Investimentos — {formatPeriodLabel(ano, mes)}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Posição real atualizada para conciliação direta com os aplicativos bancários
          </p>
        </div>

        <form
          onSubmit={handleCreateBank}
          className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <label htmlFor="new-bank-name" className="sr-only">
            Nome da nova instituição financeira
          </label>
          <input
            id="new-bank-name"
            type="text"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
            placeholder="Nova instituição (ex: Inter)"
            className="w-full sm:w-56 bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
          />
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Adicionar Banco</span>
          </button>
        </form>
      </div>

      {/* Consolidado Geral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border-[1.5px] border-[var(--card-income-border)] bg-[var(--card-income-bg)] [box-shadow:var(--card-shadow)] p-5">
          <span className="text-xs font-semibold text-[var(--semantic-income)]">
            Liquidez Total (Conta + Caixinhas - Comprometido)
          </span>
          <p className="mt-2 font-mono-nums text-2xl font-bold text-[var(--semantic-income)]">
            {formatBRL(consolidated.totalLiquidez)}
          </p>
          <p className="mt-1 font-mono-nums text-xs font-medium text-[var(--text-secondary)]">
            Conta: {formatBRL(consolidated.totalSaldoConta)} · Caixinhas:{' '}
            {formatBRL(consolidated.totalCaixinhas)}
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] [box-shadow:var(--card-shadow)] p-5">
          <span className="text-xs font-semibold text-[var(--accent-blue)]">
            Total Investimentos + Criptomoedas
          </span>
          <p className="mt-2 font-mono-nums text-2xl font-bold text-[var(--accent-blue)]">
            {formatBRL(consolidated.totalInvestidoECripto)}
          </p>
          <p className="mt-1 font-mono-nums text-xs font-medium text-[var(--text-secondary)]">
            Invest.: {formatBRL(consolidated.totalInvestimentos)} · Cripto:{' '}
            {formatBRL(consolidated.totalCripto)}
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-expense-border)] bg-[var(--card-expense-bg)] [box-shadow:var(--card-shadow)] p-5">
          <span className="text-xs font-semibold text-[var(--semantic-expense)]">
            Faturas CC &amp; Dividendos do Mês
          </span>
          <p className="mt-2 font-mono-nums text-2xl font-bold text-[var(--semantic-expense)]">
            -{formatBRL(consolidated.totalFaturaCC)}
          </p>
          <p className="mt-1 font-mono-nums text-xs text-[var(--semantic-income)] font-semibold">
            Dividendos recebidos: +{formatBRL(consolidated.totalDividendos)}
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] [box-shadow:var(--card-shadow)] p-5">
          <span className="text-xs font-semibold text-[var(--accent-gold)]">
            Patrimônio Líquido Total
          </span>
          <p className="mt-2 font-mono-nums text-2xl font-bold text-[var(--text-primary)]">
            {formatBRL(consolidated.patrimonioLiquidoTotal)}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
            Liquidez + Investimentos − Faturas CC
          </p>
        </div>
      </div>

      {/* Evolução Histórica do Patrimônio (exibida com 2 ou mais períodos YYYY-MM) */}
      {bankHistory.length >= 2 && (() => {
        const svgW = 920;
        const svgH = 220;
        const padL = 72;
        const padR = 28;
        const padT = 22;
        const padB = 34;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const allVals = bankHistory.flatMap((p) => [
          p.patrimonioInvestido,
          p.patrimonioLiquido,
        ]);
        const minVal = Math.min(0, ...allVals);
        const maxVal = Math.max(...allVals, 1);
        const range = Math.max(maxVal - minVal, 1);

        const getX = (idx: number) =>
          bankHistory.length === 1
            ? padL + plotW / 2
            : padL + (idx / (bankHistory.length - 1)) * plotW;

        const getY = (val: number) =>
          padT + plotH - ((val - minVal) / range) * plotH;

        const liquidoPoints = bankHistory
          .map((p, idx) => `${getX(idx).toFixed(1)},${getY(p.patrimonioLiquido).toFixed(1)}`)
          .join(' ');

        const investidoPoints = bankHistory
          .map((p, idx) => `${getX(idx).toFixed(1)},${getY(p.patrimonioInvestido).toFixed(1)}`)
          .join(' ');

        const liquidoArea = `${getX(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${liquidoPoints} ${getX(bankHistory.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}`;

        const gridTicks = [0, 0.5, 1].map((t) => ({
          y: padT + plotH - t * plotH,
          val: minVal + t * range,
        }));

        return (
          <div
            data-testid="bank-evolution-chart"
            className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 space-y-4 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <TrendingUp
                  className="w-4 h-4 text-[var(--accent-blue)] shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Evolução Histórica do Patrimônio ({bankHistory.length} períodos)
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Snapshots mensais consolidados por período YYYY-MM
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                  <span
                    className="w-3 h-0.5 bg-[var(--semantic-income)] inline-block"
                    aria-hidden="true"
                  />
                  Patrimônio Líquido
                </span>
                <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                  <span
                    className="w-3 h-0.5 bg-[var(--accent-blue)] inline-block"
                    aria-hidden="true"
                  />
                  Patrimônio Investido
                </span>
                {activePoint && (
                  <span className="font-mono-nums text-[var(--text-primary)] sm:pl-3 sm:border-l sm:border-[var(--border-subtle)]">
                    {MONTH_ABBR[activePoint.mes - 1]}/{activePoint.ano}:{' '}
                    <strong className="text-[var(--semantic-income)]">
                      {formatBRL(activePoint.patrimonioLiquido)}
                    </strong>{' '}
                    · Investido:{' '}
                    <strong className="text-[var(--accent-blue)]">
                      {formatBRL(activePoint.patrimonioInvestido)}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full min-w-[540px] h-56"
                role="img"
                aria-label="Gráfico de evolução histórica do patrimônio investido e patrimônio líquido"
              >
                <defs>
                  <linearGradient id="liquidoAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--semantic-income)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--semantic-income)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines & Y-Axis Labels */}
                {gridTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={padL}
                      y1={tick.y}
                      x2={svgW - padR}
                      y2={tick.y}
                      stroke="var(--chart-grid)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 10}
                      y={tick.y + 4}
                      textAnchor="end"
                      fill="var(--text-muted)"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {Math.abs(tick.val) >= 1000
                        ? `R$${(tick.val / 1000).toFixed(0)}k`
                        : `R$${Math.round(tick.val)}`}
                    </text>
                  </g>
                ))}

                {/* Area fill for Patrimônio Líquido */}
                <polygon points={liquidoArea} fill="url(#liquidoAreaGrad)" />

                {/* Series Lines */}
                <polyline
                  fill="none"
                  stroke="var(--accent-blue)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={investidoPoints}
                />
                <polyline
                  fill="none"
                  stroke="var(--semantic-income)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={liquidoPoints}
                />

                {/* Data Points & X-Axis Labels */}
                {bankHistory.map((pt, idx) => {
                  const x = getX(idx);
                  const yLiq = getY(pt.patrimonioLiquido);
                  const yInv = getY(pt.patrimonioInvestido);
                  const isFocused = activePoint?.periodoKey === pt.periodoKey;

                  return (
                    <g
                      key={pt.periodoKey}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPeriodKey(pt.periodoKey)}
                      onClick={() => setHoveredPeriodKey(pt.periodoKey)}
                    >
                      <line
                        x1={x}
                        y1={padT}
                        x2={x}
                        y2={padT + plotH}
                        stroke={isFocused ? 'var(--border-strong)' : 'transparent'}
                      />
                      <circle
                        cx={x}
                        cy={yInv}
                        r={isFocused ? 5 : 3.5}
                        fill="var(--accent-blue)"
                        stroke="var(--bg-surface)"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={x}
                        cy={yLiq}
                        r={isFocused ? 5.5 : 4}
                        fill="var(--semantic-income)"
                        stroke="var(--bg-surface)"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y={svgH - 10}
                        textAnchor="middle"
                        fill={isFocused ? 'var(--text-primary)' : 'var(--text-muted)'}
                        fontSize="11"
                        fontWeight={isFocused ? '600' : '400'}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {`${MONTH_ABBR[pt.mes - 1]}/${String(pt.ano).slice(-2)}`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })()}

      {/* Institution Blocks */}
      {banks.length === 0 ? (
        <div className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-10 text-center text-[var(--text-muted)]">
          Nenhuma instituição financeira cadastrada neste período. Adicione um banco acima.
        </div>
      ) : (
        <div className="space-y-4">
          {banks.map((bank) => {
            const metrics = computeBankMetrics(bank);
            return (
              <div
                key={bank.id}
                className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-4 sm:p-5 space-y-5"
              >
                {/* Bank Block Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2
                      className="w-5 h-5 text-[var(--accent-blue)] shrink-0"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      aria-label={`Nome da instituição ${bank.nome}`}
                      value={bank.nome}
                      onChange={(e) =>
                        onUpdateBank(bank.id, { nome: e.target.value })
                      }
                      className="min-w-0 flex-1 font-display text-lg font-bold text-[var(--text-primary)] bg-transparent border-b border-transparent focus:border-[var(--accent-underline)] focus:outline-none px-1 py-0.5"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
                    <div className="sm:text-right">
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        Subtotal Líquido
                      </span>
                      <span
                        className={`font-mono-nums text-base font-bold ${
                          metrics.subtotalLiquido >= 0
                            ? 'text-[var(--semantic-income)]'
                            : 'text-[var(--semantic-expense)]'
                        }`}
                      >
                        {formatBRL(metrics.subtotalLiquido)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openSyncModal(bank)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent-blue-border)] bg-[var(--accent-blue-bg)] hover:opacity-90 text-[var(--accent-blue)] text-xs font-semibold transition-opacity cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Sincronizar Rendimento/Aporte</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteBank(bank.id)}
                        aria-label={`Remover instituição ${bank.nome}`}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--semantic-expense)] hover:bg-[var(--semantic-expense-bg)] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 7 Bank Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <label
                      htmlFor={`${bank.id}_saldo`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Saldo em Conta
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_saldo`}
                      value={bank.saldoConta}
                      onChange={(v) => onUpdateBank(bank.id, { saldoConta: v })}
                      className="w-full text-right"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${bank.id}_comp`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Desconto / Comprometido
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_comp`}
                      value={bank.descontoComprometido}
                      onChange={(v) =>
                        onUpdateBank(bank.id, { descontoComprometido: v })
                      }
                      className="w-full text-right text-[var(--semantic-warning)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${bank.id}_caixinha`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Caixinha / Cofrinho
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_caixinha`}
                      value={bank.caixinhaCofrinho}
                      onChange={(v) =>
                        onUpdateBank(bank.id, { caixinhaCofrinho: v })
                      }
                      className="w-full text-right text-[var(--semantic-income)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${bank.id}_invest`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Investimentos
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_invest`}
                      value={bank.investimentos}
                      onChange={(v) => onUpdateBank(bank.id, { investimentos: v })}
                      className="w-full text-right text-[var(--semantic-invest)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${bank.id}_cripto`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Criptomoedas
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_cripto`}
                      value={bank.criptomoedas}
                      onChange={(v) => onUpdateBank(bank.id, { criptomoedas: v })}
                      className="w-full text-right text-[var(--semantic-invest)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${bank.id}_fatura`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Fatura CC (deduz)
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_fatura`}
                      allowNegative
                      value={bank.faturaCC}
                      onChange={(v) => onUpdateBank(bank.id, { faturaCC: v })}
                      className="w-full text-right text-[var(--semantic-expense)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${bank.id}_div`}
                      className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                    >
                      Dividendos Recebidos
                    </label>
                    <CurrencyInput
                      id={`${bank.id}_div`}
                      value={bank.dividendosRecebidos}
                      onChange={(v) =>
                        onUpdateBank(bank.id, { dividendosRecebidos: v })
                      }
                      className="w-full text-right text-[var(--semantic-income)]"
                    />
                  </div>
                </div>

                {/* Per-Bank Automatic Subtotals Line */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-[var(--text-muted)] font-mono-nums">
                  <span>
                    Liquidez disponível:{' '}
                    <strong className="text-[var(--text-primary)]">
                      {formatBRL(metrics.liquidez)}
                    </strong>
                  </span>
                  <span>
                    Total Investido + Cripto:{' '}
                    <strong className="text-[var(--semantic-invest)]">
                      {formatBRL(metrics.investidoECripto)}
                    </strong>
                  </span>
                  <span>
                    Fatura CC deduzida:{' '}
                    <strong className="text-[var(--semantic-expense)]">
                      -{formatBRL(metrics.faturaDeduction)}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sync Yield / Aporte Modal */}
      {syncBank && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-modal-backdrop)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
              <h2
                id="sync-modal-title"
                className="font-display text-base font-semibold text-[var(--text-primary)]"
              >
                Sincronizar com Controle — {syncBank.nome}
              </h2>
              <button
                type="button"
                onClick={() => setSyncBank(null)}
                aria-label="Fechar janela de sincronização"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmSync} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSyncMode('RENDIMENTO');
                    setSyncValue(syncBank.dividendosRecebidos || 0);
                    setSyncObs(`Dividendos/rendimentos ${syncBank.nome}`);
                  }}
                  className={`py-2 px-3 rounded-md text-xs font-semibold border-[1.5px] cursor-pointer ${
                    syncMode === 'RENDIMENTO'
                      ? 'bg-[var(--card-income-bg)] border-[var(--card-income-border)] text-[var(--semantic-income)]'
                      : 'bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  Rendimento / Dividendo (+ Receita)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncMode('APORTE');
                    setSyncObs(`Aporte investimentos ${syncBank.nome}`);
                  }}
                  className={`py-2 px-3 rounded-md text-xs font-semibold border-[1.5px] cursor-pointer ${
                    syncMode === 'APORTE'
                      ? 'bg-[var(--card-blue-bg)] border-[var(--card-blue-border)] text-[var(--accent-blue)]'
                      : 'bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  Novo Aporte (- Despesa/Invest.)
                </button>
              </div>

              <div>
                <label
                  htmlFor="sync-valor"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Valor a lançar no Controle (R$)
                </label>
                <CurrencyInput
                  id="sync-valor"
                  value={syncValue}
                  onChange={setSyncValue}
                  className="w-full"
                />
              </div>

              <div>
                <label
                  htmlFor="sync-titular"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Titular
                </label>
                <select
                  id="sync-titular"
                  value={syncTitular}
                  onChange={(e) => setSyncTitular(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
                >
                  {titulares.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sync-obs"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Observação
                </label>
                <input
                  id="sync-obs"
                  type="text"
                  value={syncObs}
                  onChange={(e) => setSyncObs(e.target.value)}
                  placeholder="Descrição opcional..."
                  className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
                />
              </div>

              <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setSyncBank(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border-[1.5px] border-[var(--border-strong)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-xs font-semibold text-[var(--accent-primary-text)] cursor-pointer"
                >
                  Lançar no Controle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
