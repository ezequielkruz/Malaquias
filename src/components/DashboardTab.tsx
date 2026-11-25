import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  Layers,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { BankAccount, PeriodSnapshot, Transaction } from '../types/finance';
import {
  computeCumulativeAndFutureOverview,
  computeDashboardSummary,
} from '../utils/calculations';
import { formatBRL, formatPeriodLabel, MONTH_ABBR } from '../utils/format';

interface DashboardTabProps {
  ano: number;
  mes: number;
  transactions: Transaction[];
  banks: BankAccount[];
  periods: Record<string, PeriodSnapshot>;
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
  periods,
  titulares,
  onOpenNewTransaction,
  onNavigateToBancos,
}) => {
  const [selectedTitular, setSelectedTitular] = useState<string>('Todos');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [hoveredTimelineKey, setHoveredTimelineKey] = useState<string | null>(null);

  const summary = useMemo(
    () => computeDashboardSummary(transactions, banks, selectedTitular),
    [transactions, banks, selectedTitular],
  );

  const overview = useMemo(
    () => computeCumulativeAndFutureOverview(periods, ano, mes, selectedTitular),
    [periods, ano, mes, selectedTitular],
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

  const focusedTimelinePoint =
    overview.timeline.find(
      (pt) => pt.periodoKey === (hoveredTimelineKey || overview.activeKey),
    ) ||
    overview.timeline[overview.timeline.length - 1] ||
    null;

  return (
    <section aria-label="Resumo do Mês" className="space-y-6">
      {/* Section Header + Titular Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Resumo de {formatPeriodLabel(ano, mes)}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Visão consolidada do fluxo mensal, saldo acumulado, compromissos futuros e patrimônio
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

      {/* Top KPI Grid (5 Cards) */}
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

      {/* Saldo Acumulado & Despesas Futuras Cards (sem precisar trocar período) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          data-testid="card-saldo-acumulado"
          className="rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] [box-shadow:var(--card-shadow)] p-5 flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-blue)]">
              <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Saldo Acumulado até {formatPeriodLabel(ano, mes)}</span>
            </div>
            <span className="font-mono-nums text-[11px] font-semibold text-[var(--text-secondary)]">
              {overview.periodosAteAtualCount} período(s)
            </span>
          </div>

          <p
            className={`font-mono-nums text-2xl sm:text-[26px] font-bold ${
              overview.saldoAcumuladoAtePeriodo >= 0
                ? 'text-[var(--semantic-income)]'
                : 'text-[var(--semantic-expense)]'
            }`}
          >
            {formatBRL(overview.saldoAcumuladoAtePeriodo, true)}
          </p>

          <p className="font-mono-nums text-xs text-[var(--text-secondary)]">
            Histórico anterior:{' '}
            <strong className="text-[var(--text-primary)]">
              {formatBRL(overview.saldoAcumuladoAnterior, true)}
            </strong>{' '}
            · Mês atual:{' '}
            <strong className="text-[var(--text-primary)]">
              {formatBRL(overview.saldoMesAtual, true)}
            </strong>
          </p>
        </div>

        <div
          data-testid="card-despesas-futuras"
          className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] [box-shadow:var(--card-shadow)] p-5 flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-gold)]">
              <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Despesas Futuras Programadas</span>
            </div>
            <span className="font-mono-nums text-[11px] font-semibold text-[var(--text-secondary)]">
              Após {formatPeriodLabel(ano, mes)}
            </span>
          </div>

          <p
            className={`font-mono-nums text-2xl sm:text-[26px] font-bold ${
              overview.despesasFuturasTotal > 0
                ? 'text-[var(--semantic-expense)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {formatBRL(overview.despesasFuturasTotal)}
          </p>

          <p className="font-mono-nums text-xs text-[var(--text-secondary)]">
            {overview.despesasFuturasCount > 0 ? (
              <>
                <strong className="text-[var(--text-primary)]">
                  {overview.despesasFuturasCount}
                </strong>{' '}
                despesa(s) em{' '}
                <strong className="text-[var(--text-primary)]">
                  {overview.mesesFuturosCount}
                </strong>{' '}
                mês(es)
                {overview.parcelasFuturasCount > 0
                  ? ` (${overview.parcelasFuturasCount} parcela(s))`
                  : ''}
                {overview.proximoMesComDespesa
                  ? ` · Próx: ${MONTH_ABBR[overview.proximoMesComDespesa.mes - 1]}/${overview.proximoMesComDespesa.ano} (${formatBRL(overview.proximoMesComDespesa.valor)})`
                  : ''}
              </>
            ) : (
              `Nenhuma despesa ou parcela programada após ${formatPeriodLabel(ano, mes)}`
            )}
          </p>
        </div>
      </div>

      {/* Period Charts Section (Unchanged behavior) */}
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

      {/* Complementary Block: Evolução & Projeção (Saldo Acumulado & Compromissos Futuros) */}
      <div
        data-testid="dashboard-evolution-projection"
        className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <TrendingUp
              className="w-5 h-5 text-[var(--accent-blue)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Evolução &amp; Projeção (Saldo Acumulado e Futuras)
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Acompanhe histórico acumulado, receitas e despesas/parcelas futuras sem trocar o período no topo
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-nums">
            <span className="text-[var(--text-secondary)]">
              Receitas acum.:{' '}
              <strong className="text-[var(--semantic-income)]">
                {formatBRL(overview.receitasAcumuladasAtePeriodo)}
              </strong>
            </span>
            <span className="text-[var(--text-secondary)]">
              Despesas acum.:{' '}
              <strong className="text-[var(--semantic-expense)]">
                {formatBRL(overview.despesasAcumuladasAtePeriodo)}
              </strong>
            </span>
            <span className="text-[var(--text-secondary)]">
              Futuras:{' '}
              <strong className="text-[var(--accent-gold)]">
                {formatBRL(overview.despesasFuturasTotal)}
              </strong>
            </span>
          </div>
        </div>

        {/* Multi-period SVG Chart (Bars: Receitas & Despesas, Line: Saldo Acumulado) */}
        {overview.timeline.length > 0 && (() => {
          const pts = overview.timeline;
          const svgW = Math.max(640, pts.length * 92 + 110);
          const svgH = 230;
          const padL = 74;
          const padR = 26;
          const padT = 24;
          const padB = 38;
          const plotW = svgW - padL - padR;
          const plotH = svgH - padT - padB;

          const allValues = pts.flatMap((p) => [
            0,
            p.receitas,
            p.despesas,
            p.saldoAcumulado,
          ]);
          const minVal = Math.min(0, ...allValues);
          const maxVal = Math.max(100, ...allValues);
          const range = Math.max(maxVal - minVal, 1);

          const getY = (val: number) =>
            padT + plotH - ((val - minVal) / range) * plotH;
          const zeroY = getY(0);

          const slotW = plotW / Math.max(pts.length, 1);
          const getCenterX = (idx: number) => padL + slotW * (idx + 0.5);
          const barW = Math.min(18, Math.max(10, slotW * 0.24));

          const linePoints = pts
            .map((p, idx) => `${getCenterX(idx).toFixed(1)},${getY(p.saldoAcumulado).toFixed(1)}`)
            .join(' ');

          const ticks = [minVal, minVal + range * 0.5, maxVal];

          return (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-4 text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--semantic-income)] inline-block" aria-hidden="true" />
                    Receitas
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--semantic-expense)] inline-block" aria-hidden="true" />
                    Despesas / Parcelas
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-0.5 bg-[var(--accent-blue)] inline-block" aria-hidden="true" />
                    Saldo Acumulado
                  </span>
                </div>

                {focusedTimelinePoint && (
                  <div className="font-mono-nums text-[var(--text-primary)]">
                    <strong>
                      {MONTH_ABBR[focusedTimelinePoint.mes - 1]}/
                      {focusedTimelinePoint.ano}
                    </strong>{' '}
                    ({focusedTimelinePoint.status === 'atual'
                      ? 'Período ativo'
                      : focusedTimelinePoint.status === 'futuro'
                        ? 'Projeção futura'
                        : 'Histórico'}
                    ): Rec{' '}
                    <span className="text-[var(--semantic-income)] font-semibold">
                      {formatBRL(focusedTimelinePoint.receitas)}
                    </span>{' '}
                    · Desp{' '}
                    <span className="text-[var(--semantic-expense)] font-semibold">
                      {formatBRL(focusedTimelinePoint.despesas)}
                    </span>{' '}
                    · Acum{' '}
                    <span className="text-[var(--accent-blue)] font-bold">
                      {formatBRL(focusedTimelinePoint.saldoAcumulado, true)}
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full min-w-[540px] h-56"
                  role="img"
                  aria-label="Gráfico de evolução e projeção de receitas, despesas futuras e saldo acumulado"
                >
                  {ticks.map((val, i) => {
                    const y = getY(val);
                    return (
                      <g key={i}>
                        <line
                          x1={padL}
                          y1={y}
                          x2={svgW - padR}
                          y2={y}
                          stroke="var(--chart-grid)"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padL - 8}
                          y={y + 4}
                          textAnchor="end"
                          fill="var(--text-muted)"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {Math.abs(val) >= 1000
                            ? `${val < 0 ? '-' : ''}R$${(Math.abs(val) / 1000).toFixed(1)}k`
                            : `R$${Math.round(val)}`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Zero baseline */}
                  <line
                    x1={padL}
                    y1={zeroY}
                    x2={svgW - padR}
                    y2={zeroY}
                    stroke="var(--border-strong)"
                    strokeWidth="1"
                  />

                  {pts.map((pt, idx) => {
                    const cx = getCenterX(idx);
                    const recY = getY(pt.receitas);
                    const despY = getY(pt.despesas);
                    const recH = Math.max(zeroY - recY, pt.receitas > 0 ? 3 : 0);
                    const despH = Math.max(zeroY - despY, pt.despesas > 0 ? 3 : 0);
                    const isFocused =
                      focusedTimelinePoint?.periodoKey === pt.periodoKey;

                    return (
                      <g
                        key={pt.periodoKey}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTimelineKey(pt.periodoKey)}
                        onClick={() => setHoveredTimelineKey(pt.periodoKey)}
                      >
                        <rect
                          x={cx - slotW * 0.44}
                          y={padT}
                          width={slotW * 0.88}
                          height={plotH}
                          rx="6"
                          fill={
                            pt.status === 'atual'
                              ? 'var(--accent-gold-bg)'
                              : isFocused
                                ? 'var(--bg-surface-hover)'
                                : 'transparent'
                          }
                          opacity={pt.status === 'atual' ? 0.65 : 0.7}
                        />
                        <rect
                          x={cx - barW - 2}
                          y={zeroY - recH}
                          width={barW}
                          height={recH}
                          rx="3"
                          fill="var(--semantic-income)"
                          opacity={pt.status === 'futuro' ? 0.65 : 0.92}
                        />
                        <rect
                          x={cx + 2}
                          y={zeroY - despH}
                          width={barW}
                          height={despH}
                          rx="3"
                          fill="var(--semantic-expense)"
                          opacity={pt.status === 'futuro' ? 0.72 : 0.92}
                        />
                        <text
                          x={cx}
                          y={svgH - 12}
                          textAnchor="middle"
                          fill={
                            pt.status === 'atual' || isFocused
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)'
                          }
                          fontSize="11"
                          fontWeight={pt.status === 'atual' ? '700' : '500'}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {`${MONTH_ABBR[pt.mes - 1]}/${String(pt.ano).slice(-2)}${pt.status === 'futuro' ? '*' : ''}`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Cumulative Balance Line */}
                  {pts.length >= 2 && (
                    <polyline
                      fill="none"
                      stroke="var(--accent-blue)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={linePoints}
                    />
                  )}

                  {pts.map((pt, idx) => {
                    const cx = getCenterX(idx);
                    const cy = getY(pt.saldoAcumulado);
                    const isFocused =
                      focusedTimelinePoint?.periodoKey === pt.periodoKey;
                    return (
                      <circle
                        key={`dot-${pt.periodoKey}`}
                        cx={cx}
                        cy={cy}
                        r={isFocused ? 5.5 : 4}
                        fill="var(--accent-blue)"
                        stroke="var(--bg-surface)"
                        strokeWidth="1.5"
                        className="pointer-events-none"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })()}

        {/* Compact Multi-Period Breakdown Table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-[var(--bg-header)] text-xs font-semibold text-[var(--text-secondary)]">
                <th className="py-2.5 px-3 border-b border-[var(--border-subtle)]">Período</th>
                <th className="py-2.5 px-3 border-b border-[var(--border-subtle)]">Situação</th>
                <th className="py-2.5 px-3 border-b border-[var(--border-subtle)] text-right">Receitas</th>
                <th className="py-2.5 px-3 border-b border-[var(--border-subtle)] text-right">Despesas</th>
                <th className="py-2.5 px-3 border-b border-[var(--border-subtle)] text-right">Saldo do Mês</th>
                <th className="py-2.5 px-3 border-b border-[var(--border-subtle)] text-right">Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs sm:text-sm font-mono-nums">
              {overview.timeline.map((pt) => (
                <tr
                  key={pt.periodoKey}
                  className={
                    pt.status === 'atual'
                      ? 'bg-[var(--card-gold-bg)] font-semibold'
                      : 'hover:bg-[var(--bg-surface-hover)]'
                  }
                >
                  <td className="py-2 px-3 text-[var(--text-primary)]">
                    {MONTH_ABBR[pt.mes - 1]} / {pt.ano}
                  </td>
                  <td className="py-2 px-3 font-sans text-xs">
                    {pt.status === 'atual' ? (
                      <span className="font-semibold text-[var(--accent-gold)]">
                        Mês atual
                      </span>
                    ) : pt.status === 'futuro' ? (
                      <span className="font-semibold text-[var(--accent-blue)]">
                        Futuro{pt.parcelasCount > 0 ? ` (${pt.parcelasCount} parc.)` : ''}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">Histórico</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--semantic-income)]">
                    {formatBRL(pt.receitas)}
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--semantic-expense)]">
                    {formatBRL(pt.despesas)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      pt.saldoMes >= 0
                        ? 'text-[var(--semantic-income)]'
                        : 'text-[var(--semantic-expense)]'
                    }`}
                  >
                    {formatBRL(pt.saldoMes, true)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-bold ${
                      pt.saldoAcumulado >= 0
                        ? 'text-[var(--accent-blue)]'
                        : 'text-[var(--semantic-expense)]'
                    }`}
                  >
                    {formatBRL(pt.saldoAcumulado, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
