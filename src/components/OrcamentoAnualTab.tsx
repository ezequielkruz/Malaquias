import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CategoryConfig, PeriodSnapshot } from '../types/finance';
import { computeAnnualPivot } from '../utils/calculations';
import { formatBRL, MONTH_ABBR } from '../utils/format';

interface OrcamentoAnualTabProps {
  ano: number;
  periods: Record<string, PeriodSnapshot>;
  categories: CategoryConfig[];
}

export const OrcamentoAnualTab: React.FC<OrcamentoAnualTabProps> = ({
  ano,
  periods,
  categories,
}) => {
  const pivot = useMemo(
    () => computeAnnualPivot(periods, categories, ano),
    [periods, categories, ano],
  );

  // Expanded groups state
  const [expandedReceitasSection, setExpandedReceitasSection] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    RECEITAS: true,
    ALIMENTAÇÃO: true,
    CASA: true,
  });

  // Selected category for monthly evolution bar chart
  const [selectedChartKey, setSelectedChartKey] = useState<string>('TOTAL_DESPESAS');

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Determine chart series based on selected row
  const chartData = useMemo(() => {
    if (selectedChartKey === 'TOTAL_RECEITAS') {
      return {
        label: 'Total Receitas',
        color: 'bg-[var(--semantic-income)]',
        months: pivot.totalReceitasMonths,
        total: pivot.totalReceitasAno,
      };
    }
    if (selectedChartKey === 'TOTAL_DESPESAS') {
      return {
        label: 'Total Despesas',
        color: 'bg-[var(--semantic-expense)]',
        months: pivot.totalDespesasMonths,
        total: pivot.totalDespesasAno,
      };
    }
    if (selectedChartKey === 'SALDO') {
      return {
        label: 'Saldo Mensal (Receitas − Despesas)',
        color: 'bg-[var(--accent-secondary)]',
        months: pivot.saldoMonths,
        total: pivot.saldoAno,
      };
    }

    const foundRec = pivot.receitasGroups.find(
      (g) => `REC::${g.categoria}` === selectedChartKey,
    );
    if (foundRec) {
      return {
        label: `Receitas: ${foundRec.categoria}`,
        color: 'bg-[var(--semantic-income)]',
        months: foundRec.months,
        total: foundRec.total,
      };
    }

    const foundDesp = pivot.despesasGroups.find(
      (g) => `DESP::${g.categoria}` === selectedChartKey,
    );
    if (foundDesp) {
      return {
        label: `Despesas: ${foundDesp.categoria}`,
        color: 'bg-[var(--semantic-invest)]',
        months: foundDesp.months,
        total: foundDesp.total,
      };
    }

    return {
      label: 'Total Despesas',
      color: 'bg-[var(--semantic-expense)]',
      months: pivot.totalDespesasMonths,
      total: pivot.totalDespesasAno,
    };
  }, [pivot, selectedChartKey]);

  const maxChartVal = Math.max(
    ...chartData.months.map((v) => Math.abs(v)),
    1,
  );

  return (
    <section aria-label="Orçamento Anual" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Orçamento Anual — {ano}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Visão consolidada JAN–DEZ alimentada pelo armazenamento local e arquivos JSON importados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedChartKey('TOTAL_RECEITAS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-[1.5px] transition-colors cursor-pointer ${
              selectedChartKey === 'TOTAL_RECEITAS'
                ? 'bg-[var(--card-income-bg)] border-[var(--card-income-border)] text-[var(--semantic-income)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            Gráfico: Receitas
          </button>
          <button
            type="button"
            onClick={() => setSelectedChartKey('TOTAL_DESPESAS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-[1.5px] transition-colors cursor-pointer ${
              selectedChartKey === 'TOTAL_DESPESAS'
                ? 'bg-[var(--card-expense-bg)] border-[var(--card-expense-border)] text-[var(--semantic-expense)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            Gráfico: Despesas
          </button>
          <button
            type="button"
            onClick={() => setSelectedChartKey('SALDO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-[1.5px] transition-colors cursor-pointer ${
              selectedChartKey === 'SALDO'
                ? 'bg-[var(--card-gold-bg)] border-[var(--card-gold-border)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            Gráfico: Saldo
          </button>
        </div>
      </div>

      {/* Category Evolution Bar Chart */}
      <div className="rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-sm sm:text-base font-semibold text-[var(--text-primary)]">
              Evolução Mensal: {chartData.label}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Clique em qualquer categoria na matriz abaixo para inspecionar sua evolução mensal
            </p>
          </div>
          <span className="font-mono-nums text-sm font-bold text-[var(--text-primary)]">
            Acumulado {ano}: {formatBRL(chartData.total)}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-1 sm:gap-2 items-end h-40 pt-4 border-b border-[var(--border-subtle)] pb-2">
          {MONTH_ABBR.map((mAbbr, idx) => {
            const val = chartData.months[idx] || 0;
            const pct = (Math.abs(val) / maxChartVal) * 100;
            const barColor =
              selectedChartKey === 'SALDO'
                ? val >= 0
                  ? 'bg-[var(--semantic-income)]'
                  : 'bg-[var(--semantic-expense)]'
                : chartData.color;

            return (
              <div
                key={mAbbr}
                className="flex flex-col items-center justify-end h-full gap-1.5 min-w-0"
                title={`${mAbbr}/${ano}: ${formatBRL(val)}`}
              >
                <span className="font-mono-nums text-[9px] sm:text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-full">
                  {val !== 0
                    ? Math.abs(val) >= 1000
                      ? `${(val / 1000).toFixed(1)}k`
                      : Math.round(val)
                    : ''}
                </span>
                <div className="w-full max-w-[32px] h-24 bg-[var(--chart-track)] rounded-t flex items-end overflow-hidden border border-[var(--border-subtle)]">
                  <div
                    className={`w-full ${barColor} transition-all duration-300`}
                    style={{
                      height: `${Math.max(pct, val !== 0 ? 5 : 0)}%`,
                    }}
                  />
                </div>
                <span className="font-mono-nums text-[9px] sm:text-[11px] font-semibold text-[var(--text-muted)]">
                  {mAbbr}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pivot Matrix Table JAN-DEZ + TOTAL (Sticky header vertically + Sticky first column horizontally) */}
      <div className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] min-w-0">
        <div className="sm:hidden px-3.5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] rounded-t-[10px] flex items-center justify-between text-[11px] font-medium text-[var(--text-secondary)]">
          <span>Coluna fixa à esquerda</span>
          <span className="text-[var(--accent-blue)] font-semibold">Deslize JAN–DEZ →</span>
        </div>
        <div className="overflow-auto max-h-[68vh] sm:max-h-[72vh] rounded-b-[10px] sm:rounded-[10px]">
          <table className="honey-table w-full text-left border-collapse min-w-[1140px]">
            <thead>
              <tr className="text-xs font-semibold text-[var(--text-secondary)]">
                <th className="py-3 px-3 sm:px-4 sticky top-0 left-0 z-30 bg-[var(--bg-header)] border-b border-r border-[var(--border-subtle)] w-40 min-w-[160px] sm:w-64 sm:min-w-[240px]">
                  Categoria / Subcategoria
                </th>
                {MONTH_ABBR.map((m) => (
                  <th
                    key={m}
                    className="py-3 px-2.5 sticky top-0 z-20 bg-[var(--bg-header)] border-b border-[var(--border-subtle)] text-right font-mono-nums w-24"
                  >
                    {m}
                  </th>
                ))}
                <th className="py-3 px-4 sticky top-0 z-20 bg-[var(--bg-header)] border-b border-[var(--border-subtle)] text-right font-mono-nums w-28 text-[var(--text-primary)]">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs sm:text-sm">
              {/* FONTES DE RECEITA Header */}
              <tr className="honey-pivot-row bg-[var(--pivot-income-bg)]">
                <td className="py-2.5 px-3 sm:px-4 sticky left-0 z-10 bg-[var(--pivot-income-bg)] border-r border-[var(--border-subtle)] font-semibold text-[var(--semantic-income)]">
                  <button
                    type="button"
                    aria-expanded={expandedReceitasSection}
                    onClick={() =>
                      setExpandedReceitasSection((prev) => !prev)
                    }
                    className="flex items-center gap-2 w-full text-left cursor-pointer"
                  >
                    {expandedReceitasSection ? (
                      <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>FONTES DE RECEITA</span>
                  </button>
                </td>
                {pivot.totalReceitasMonths.map((val, idx) => (
                  <td
                    key={idx}
                    className="py-2.5 px-2.5 text-right font-mono-nums font-semibold text-[var(--semantic-income)]"
                  >
                    {val > 0 ? formatBRL(val) : '—'}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-mono-nums font-bold text-[var(--semantic-income)]">
                  {formatBRL(pivot.totalReceitasAno)}
                </td>
              </tr>

              {expandedReceitasSection &&
                pivot.receitasGroups.map((grp) => {
                  const isOpen = !!expandedGroups[grp.categoria];
                  const isSelected = selectedChartKey === `REC::${grp.categoria}`;
                  const rowStickyBg = isSelected
                    ? 'bg-[var(--card-income-bg)]'
                    : 'bg-[var(--bg-surface)] group-hover:bg-[var(--bg-surface-alt)]';
                  return (
                    <React.Fragment key={`rec_${grp.categoria}`}>
                      <tr
                        className={`group hover:bg-[var(--bg-surface-hover)] transition-colors ${
                          isSelected ? 'bg-[var(--card-income-bg)]' : ''
                        }`}
                      >
                        <td
                          className={`py-2 px-3 sm:px-4 pl-5 sm:pl-7 sticky left-0 z-10 ${rowStickyBg} border-r border-[var(--border-subtle)] transition-colors font-medium text-[var(--text-primary)]`}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-label={`Expandir ${grp.categoria}`}
                              onClick={() => toggleGroup(grp.categoria)}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                            >
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedChartKey(`REC::${grp.categoria}`)
                              }
                              className="text-left hover:text-[var(--semantic-income)] cursor-pointer truncate"
                            >
                              {grp.categoria}
                            </button>
                          </div>
                        </td>
                        {grp.months.map((val, idx) => (
                          <td
                            key={idx}
                            className="py-2 px-2.5 text-right font-mono-nums text-[var(--semantic-income)]"
                          >
                            {val > 0 ? formatBRL(val) : '—'}
                          </td>
                        ))}
                        <td className="py-2 px-4 text-right font-mono-nums font-semibold text-[var(--semantic-income)]">
                          {formatBRL(grp.total)}
                        </td>
                      </tr>

                      {isOpen &&
                        grp.subcategories.map((sub) => (
                          <tr
                            key={`rec_sub_${grp.categoria}_${sub.subcategoria}`}
                            className="hover:bg-[var(--bg-surface-hover)] text-xs"
                          >
                            <td className="py-1.5 px-3 sm:px-4 pl-9 sm:pl-14 sticky left-0 z-10 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] text-[var(--text-muted)] truncate max-w-[160px] sm:max-w-[240px]">
                              {sub.subcategoria}
                            </td>
                            {sub.months.map((val, idx) => (
                              <td
                                key={idx}
                                className="py-1.5 px-2.5 text-right font-mono-nums text-[var(--text-muted)]"
                              >
                                {val > 0 ? formatBRL(val) : '—'}
                              </td>
                            ))}
                            <td className="py-1.5 px-4 text-right font-mono-nums text-[var(--text-secondary)]">
                              {sub.total > 0 ? formatBRL(sub.total) : '—'}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}

              {/* DESPESAS Header */}
              <tr className="honey-pivot-row bg-[var(--pivot-expense-bg)]">
                <td className="py-2.5 px-3 sm:px-4 sticky left-0 z-10 bg-[var(--pivot-expense-bg)] border-r border-[var(--border-subtle)] font-semibold text-[var(--semantic-expense)]">
                  DESPESAS (CONSOLIDADO)
                </td>
                {pivot.totalDespesasMonths.map((val, idx) => (
                  <td
                    key={idx}
                    className="py-2.5 px-2.5 text-right font-mono-nums font-semibold text-[var(--semantic-expense)]"
                  >
                    {val > 0 ? formatBRL(val) : '—'}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-mono-nums font-bold text-[var(--semantic-expense)]">
                  {formatBRL(pivot.totalDespesasAno)}
                </td>
              </tr>

              {pivot.despesasGroups.map((grp) => {
                const isOpen = !!expandedGroups[grp.categoria];
                const isSelected = selectedChartKey === `DESP::${grp.categoria}`;
                const rowStickyBg = isSelected
                  ? 'bg-[var(--card-gold-bg)]'
                  : 'bg-[var(--bg-surface)] group-hover:bg-[var(--bg-surface-alt)]';
                return (
                  <React.Fragment key={`desp_${grp.categoria}`}>
                    <tr
                      className={`group hover:bg-[var(--bg-surface-hover)] transition-colors ${
                        isSelected ? 'bg-[var(--card-gold-bg)]' : ''
                      }`}
                    >
                      <td
                        className={`py-2 px-3 sm:px-4 pl-5 sm:pl-7 sticky left-0 z-10 ${rowStickyBg} border-r border-[var(--border-subtle)] transition-colors font-medium text-[var(--text-primary)]`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`Expandir ${grp.categoria}`}
                            onClick={() => toggleGroup(grp.categoria)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedChartKey(`DESP::${grp.categoria}`)
                            }
                            className="text-left hover:text-[var(--semantic-invest)] cursor-pointer truncate"
                          >
                            {grp.categoria}
                          </button>
                        </div>
                      </td>
                      {grp.months.map((val, idx) => (
                        <td
                          key={idx}
                          className="py-2 px-2.5 text-right font-mono-nums text-[var(--text-secondary)]"
                        >
                          {val > 0 ? formatBRL(val) : '—'}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right font-mono-nums font-semibold text-[var(--semantic-expense)]">
                        {formatBRL(grp.total)}
                      </td>
                    </tr>

                    {isOpen &&
                      grp.subcategories.map((sub) => (
                        <tr
                          key={`desp_sub_${grp.categoria}_${sub.subcategoria}`}
                          className="hover:bg-[var(--bg-surface-hover)] text-xs"
                        >
                          <td className="py-1.5 px-3 sm:px-4 pl-9 sm:pl-14 sticky left-0 z-10 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] text-[var(--text-muted)] truncate max-w-[160px] sm:max-w-[240px]">
                            {sub.subcategoria}
                          </td>
                          {sub.months.map((val, idx) => (
                            <td
                              key={idx}
                              className="py-1.5 px-2.5 text-right font-mono-nums text-[var(--text-muted)]"
                            >
                              {val > 0 ? formatBRL(val) : '—'}
                            </td>
                          ))}
                          <td className="py-1.5 px-4 text-right font-mono-nums text-[var(--text-secondary)]">
                            {sub.total > 0 ? formatBRL(sub.total) : '—'}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}

              {/* SALDO ANUAL Row */}
              <tr className="honey-pivot-row bg-[var(--bg-header)] border-t-2 border-[var(--border-strong)]">
                <td className="py-3 px-3 sm:px-4 sticky left-0 z-10 bg-[var(--bg-header)] border-r border-[var(--border-subtle)] font-display font-bold text-[var(--text-primary)]">
                  SALDO MENSAL / ANUAL
                </td>
                {pivot.saldoMonths.map((val, idx) => (
                  <td
                    key={idx}
                    className={`py-3 px-2.5 text-right font-mono-nums font-bold ${
                      val > 0
                        ? 'text-[var(--semantic-income)]'
                        : val < 0
                          ? 'text-[var(--semantic-expense)]'
                          : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {val !== 0 ? formatBRL(val, true) : '—'}
                  </td>
                ))}
                <td
                  className={`py-3 px-4 text-right font-mono-nums font-bold ${
                    pivot.saldoAno >= 0
                      ? 'text-[var(--semantic-income)]'
                      : 'text-[var(--semantic-expense)]'
                  }`}
                >
                  {formatBRL(pivot.saldoAno, true)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
