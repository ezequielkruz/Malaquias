import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Landmark, Plus, Wallet } from 'lucide-react';
import type { BankAccount, Transaction } from '../types/finance';
import { computeDashboardSummary } from '../utils/calculations';
import { formatBRL, formatPeriodLabel } from '../utils/format';

interface DashboardTabProps {
  ano: number;
  mes: number;
  transactions: Transaction[];
  banks: BankAccount[];
  titulares: string[];
  onOpenNewTransaction: () => void;
  onNavigateToBancos: () => void;
}

const CHART_PALETTE = [
  '#0284C7', // Sky
  '#059669', // Emerald
  '#E11D48', // Rose
  '#D97706', // Amber
  '#6366F1', // Indigo
  '#9333EA', // Purple
  '#0D9488', // Teal
  '#FB7185', // Coral
  '#3B82F6', // Blue
  '#CA8A04', // Gold
  '#10B981', // Mint
  '#A855F7', // Violet
];

export const DashboardTab: React.FC<DashboardTabProps> = ({
  ano,
  mes,
  transactions,
  banks,
  titulares,
  onOpenNewTransaction,
  onNavigateToBancos,
}) => {
  const [selectedTitular, setSelectedTitular] = useState<string>('Todos');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const summary = useMemo(
    () => computeDashboardSummary(transactions, banks, selectedTitular),
    [transactions, banks, selectedTitular],
  );

  // Build SVG Donut arcs
  const donutSlices = useMemo(() => {
    const items = summary.despesasPorCategoria;
    if (items.length === 0) return [];
    const radius = 76;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercent = 0;

    return items.map((item, idx) => {
      const dashLength = (item.percentual / 100) * circumference;
      const dashOffset = -(cumulativePercent / 100) * circumference;
      cumulativePercent += item.percentual;
      return {
        ...item,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
        dashArray: `${Math.max(dashLength - 2, 1)} ${circumference}`,
        dashOffset,
      };
    });
  }, [summary.despesasPorCategoria]);

  const activeSlice =
    donutSlices.find((s) => s.categoria === hoveredCat) || donutSlices[0] || null;

  const maxBarValue = Math.max(summary.totalReceitas, summary.totalDespesas, 1);
  const receitaHeightPct = (summary.totalReceitas / maxBarValue) * 100;
  const despesaHeightPct = (summary.totalDespesas / maxBarValue) * 100;

  return (
    <section aria-label="Resumo do Mês" className="space-y-6">
      {/* Section Header + Titular Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Resumo de {formatPeriodLabel(ano, mes)}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Visão consolidada do fluxo mensal, meios de pagamento e patrimônio investido
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <label
            htmlFor="dashboard-titular-filter"
            className="text-xs font-semibold text-[var(--accent-blue)] whitespace-nowrap"
          >
            Filtrar por Titular
          </label>
          <select
            id="dashboard-titular-filter"
            value={selectedTitular}
            onChange={(e) => setSelectedTitular(e.target.value)}
            className="flex-1 sm:flex-initial bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)] cursor-pointer"
          >
            <option value="Todos">Todos os titulares</option>
            {titulares.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border-[1.5px] border-[var(--card-income-border)] bg-[var(--card-income-bg)] [box-shadow:var(--card-shadow)] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--semantic-income)]">
            <span>Total Receitas</span>
            <ArrowUpRight className="w-4 h-4 text-[var(--semantic-income)]" aria-hidden="true" />
          </div>
          <p className="mt-2.5 font-mono-nums text-2xl font-bold text-[var(--semantic-income)]">
            {formatBRL(summary.totalReceitas)}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">Entradas no período</p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-expense-border)] bg-[var(--card-expense-bg)] [box-shadow:var(--card-shadow)] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--semantic-expense)]">
            <span>Total Despesas</span>
            <ArrowDownRight className="w-4 h-4 text-[var(--semantic-expense)]" aria-hidden="true" />
          </div>
          <p className="mt-2.5 font-mono-nums text-2xl font-bold text-[var(--semantic-expense)]">
            {formatBRL(summary.totalDespesas)}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">Saídas no período</p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] [box-shadow:var(--card-shadow)] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--accent-gold)]">
            <span>Saldo do Mês</span>
            <Wallet className="w-4 h-4 text-[var(--accent-gold)]" aria-hidden="true" />
          </div>
          <p
            className={`mt-2.5 font-mono-nums text-2xl font-bold ${
              summary.saldoMes >= 0
                ? 'text-[var(--semantic-income)]'
                : 'text-[var(--semantic-expense)]'
            }`}
          >
            {formatBRL(summary.saldoMes, true)}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--accent-gold)]">
            {summary.saldoMes >= 0 ? 'Superávit mensal' : 'Déficit mensal'}
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-cyan-border)] bg-[var(--card-cyan-bg)] [box-shadow:var(--card-shadow)] p-5">
          <div className="text-xs font-semibold text-[var(--accent-blue)]">
            Por Meio de Pagamento
          </div>
          <div className="mt-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] font-semibold">PIXD</span>
              <span className="font-mono-nums text-[var(--text-primary)] font-bold">
                {formatBRL(summary.totalPIXD)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] font-semibold">CC</span>
              <span className="font-mono-nums text-[var(--text-primary)] font-bold">
                {formatBRL(summary.totalCC)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] font-semibold">PIXR</span>
              <span className="font-mono-nums text-[var(--semantic-income)] font-bold">
                {formatBRL(summary.totalPIXR)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] [box-shadow:var(--card-shadow)] p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--accent-blue)]">
            <span>Patrimônio Investido</span>
            <Landmark className="w-4 h-4 text-[var(--accent-blue)]" aria-hidden="true" />
          </div>
          <p className="mt-2.5 font-mono-nums text-2xl font-bold text-[var(--accent-blue)]">
            {formatBRL(summary.patrimonioInvestido)}
          </p>
          <button
            type="button"
            onClick={onNavigateToBancos}
            className="mt-1 text-xs font-semibold text-[var(--accent-blue)] underline-offset-2 hover:underline cursor-pointer"
          >
            Líquido total: {formatBRL(summary.patrimonioLiquidoTotal)}
          </button>
        </div>
      </div>

      {/* Charts Section */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Nenhum lançamento registrado em {formatPeriodLabel(ano, mes)}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-md mx-auto">
            Adicione receitas e despesas ou importe um arquivo JSON do período para visualizar os gráficos e indicadores.
          </p>
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-sm font-semibold text-[var(--accent-primary-text)] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Registrar Primeiro Lançamento</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Donut Chart: Despesas por Categoria */}
          <div className="lg:col-span-7 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                  Distribuição de Despesas por Categoria
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Passe o cursor ou clique em uma categoria para detalhar percentual e valor
                </p>
              </div>
              <span className="font-mono-nums text-xs font-semibold px-2.5 py-1 rounded-md border border-[var(--accent-blue-border)] bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] shrink-0">
                {summary.despesasPorCategoria.length} categorias
              </span>
            </div>

            {summary.despesasPorCategoria.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-10 text-center">
                Nenhuma despesa para o titular selecionado.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* SVG Donut */}
                <div className="md:col-span-5 flex items-center justify-center">
                  <div className="relative w-52 h-52">
                    <svg
                      viewBox="0 0 200 200"
                      className="w-full h-full -rotate-90"
                      role="img"
                      aria-label="Gráfico de rosca de despesas por categoria"
                    >
                      <circle
                        cx="100"
                        cy="100"
                        r="76"
                        fill="transparent"
                        stroke="var(--chart-track)"
                        strokeWidth="24"
                      />
                      {donutSlices.map((slice) => {
                        const isHighlighted = activeSlice?.categoria === slice.categoria;
                        return (
                          <circle
                            key={slice.categoria}
                            cx="100"
                            cy="100"
                            r="76"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={isHighlighted ? 28 : 24}
                            strokeDasharray={slice.dashArray}
                            strokeDashoffset={slice.dashOffset}
                            className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setHoveredCat(slice.categoria)}
                            onClick={() => setHoveredCat(slice.categoria)}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                      <span className="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-full">
                        {activeSlice ? activeSlice.categoria : 'Total'}
                      </span>
                      <span className="font-mono-nums text-base font-bold text-[var(--text-primary)] mt-0.5">
                        {activeSlice
                          ? formatBRL(activeSlice.valor)
                          : formatBRL(summary.totalDespesas)}
                      </span>
                      {activeSlice && (
                        <span className="font-mono-nums text-xs text-[var(--text-muted)] mt-0.5">
                          {activeSlice.percentual.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Category Breakdown Table */}
                <div className="md:col-span-7 divide-y divide-[var(--border-subtle)] max-h-80 overflow-y-auto pr-1">
                  {donutSlices.map((slice) => {
                    const isActive = activeSlice?.categoria === slice.categoria;
                    return (
                      <button
                        key={slice.categoria}
                        type="button"
                        onMouseEnter={() => setHoveredCat(slice.categoria)}
                        onClick={() => setHoveredCat(slice.categoria)}
                        className={`w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[var(--bg-surface-hover)]'
                            : 'hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: slice.color }}
                            aria-hidden="true"
                          />
                          <span className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] truncate">
                            {slice.categoria}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 shrink-0 font-mono-nums text-xs sm:text-sm">
                          <span className="text-[var(--text-muted)] w-11 text-right">
                            {slice.percentual.toFixed(1)}%
                          </span>
                          <span className="text-[var(--text-primary)] font-semibold w-24 text-right">
                            {formatBRL(slice.valor)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bar Chart: Receitas vs Despesas */}
          <div className="lg:col-span-5 rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                Receitas vs. Despesas
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Comparativo direto do período selecionado
              </p>
            </div>

            <div className="my-6 flex items-end justify-center gap-10 sm:gap-12 h-52 border-b border-[var(--border-subtle)] pb-2 px-4">
              {/* Receitas Bar */}
              <div className="flex flex-col items-center gap-2 h-full justify-end w-24 sm:w-28">
                <span className="font-mono-nums text-xs font-bold text-[var(--semantic-income)] whitespace-nowrap">
                  {formatBRL(summary.totalReceitas)}
                </span>
                <div className="w-14 sm:w-16 bg-[var(--chart-track)] rounded-t-md h-36 flex items-end overflow-hidden border-[1.5px] border-[var(--card-income-border)]">
                  <div
                    className="w-full bg-[var(--semantic-income)] transition-all duration-300"
                    style={{ height: `${Math.max(receitaHeightPct, summary.totalReceitas > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Receitas</span>
              </div>

              {/* Despesas Bar */}
              <div className="flex flex-col items-center gap-2 h-full justify-end w-24 sm:w-28">
                <span className="font-mono-nums text-xs font-bold text-[var(--semantic-expense)] whitespace-nowrap">
                  {formatBRL(summary.totalDespesas)}
                </span>
                <div className="w-14 sm:w-16 bg-[var(--chart-track)] rounded-t-md h-36 flex items-end overflow-hidden border-[1.5px] border-[var(--card-expense-border)]">
                  <div
                    className="w-full bg-[var(--semantic-expense)] transition-all duration-300"
                    style={{ height: `${Math.max(despesaHeightPct, summary.totalDespesas > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Despesas</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
              <span className="font-medium">Taxa de poupança do mês</span>
              <span className="font-mono-nums font-bold text-[var(--text-primary)]">
                {summary.totalReceitas > 0
                  ? `${((summary.saldoMes / summary.totalReceitas) * 100).toFixed(1)}%`
                  : '0.0%'}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
