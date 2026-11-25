import React, { useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Palette,
  Plus,
  RotateCcw,
  Upload,
} from 'lucide-react';
import type { TabId } from '../types/finance';
import { MONTH_ABBR } from '../utils/format';
import { THEME_OPTIONS, type ThemeId } from '../utils/theme';

interface HeaderNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenNewTransaction: () => void;
  activeAno: number;
  activeMes: number;
  availableYears: number[];
  onChangePeriod: (ano: number, mes: number) => void;
  onExportPeriodJson: () => void;
  onImportJsonFiles: (files: FileList) => void;
  onOpenResetModal: () => void;
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'resumo', label: 'Resumo do Mês' },
  { id: 'controle', label: 'Controle' },
  { id: 'bancos', label: 'Bancos & Investimentos' },
  { id: 'anual', label: 'Orçamento Anual' },
  { id: 'categorias', label: 'Categorias' },
];

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTransaction,
  activeAno,
  activeMes,
  availableYears,
  onChangePeriod,
  onExportPeriodJson,
  onImportJsonFiles,
  onOpenResetModal,
  theme,
  onChangeTheme,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePrevMonth = () => {
    if (activeMes === 1) {
      onChangePeriod(activeAno - 1, 12);
    } else {
      onChangePeriod(activeAno, activeMes - 1);
    }
  };

  const handleNextMonth = () => {
    if (activeMes === 12) {
      onChangePeriod(activeAno + 1, 1);
    } else {
      onChangePeriod(activeAno, activeMes + 1);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportJsonFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <>
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-header)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-0 lg:h-16 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-6">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-sm bg-[var(--accent-gold)] ring-2 ring-[var(--accent-blue)]/30"
            />
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Gestor Financeiro 3.10
            </span>
          </div>

          {/* Zone 2: Primary Tabs (Desktop) */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-5 xl:gap-6"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none ${
                    isActive
                      ? 'text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--accent-blue)]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t bg-[var(--accent-underline)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme Selector + Primary Action */}
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] rounded-lg px-2.5 py-1.5 min-w-0">
              <Palette
                className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0"
                aria-hidden="true"
              />
              <label htmlFor="theme-selector" className="sr-only">
                Selecionar tema de cores
              </label>
              <select
                id="theme-selector"
                aria-label="Selecionar tema de cores"
                value={theme}
                onChange={(e) => onChangeTheme(e.target.value as ThemeId)}
                className="bg-transparent text-xs font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer max-w-[175px] sm:max-w-none truncate"
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-underline)]"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Novo Lançamento</span>
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Horizontal Scroll Tab Bar (no text clipped mid-word) */}
        <nav
          aria-label="Navegação móvel"
          className="lg:hidden border-t border-[var(--border-subtle)] px-4 overflow-x-auto flex items-center gap-5"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-3 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--text-primary)] font-semibold border-b-2 border-[var(--accent-underline)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--accent-blue)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Workspace Period & JSON Portability Bar */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Active Period Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <span className="text-xs font-bold text-[var(--accent-blue)] whitespace-nowrap">
              Período Ativo
            </span>
            <div className="flex items-center border-[1.5px] border-[var(--border-strong)] rounded-lg bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mês anterior"
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <label htmlFor="period-month-select" className="sr-only">
                Mês do período ativo
              </label>
              <select
                id="period-month-select"
                value={activeMes}
                onChange={(e) =>
                  onChangePeriod(activeAno, Number(e.target.value))
                }
                className="bg-transparent text-sm font-semibold text-[var(--text-primary)] px-2 py-1.5 focus:outline-none cursor-pointer"
              >
                {MONTH_ABBR.map((abbr, idx) => (
                  <option key={abbr} value={idx + 1}>
                    {abbr}
                  </option>
                ))}
              </select>

              <span className="text-[var(--text-muted)] select-none">/</span>

              <label htmlFor="period-year-select" className="sr-only">
                Ano do período ativo
              </label>
              <select
                id="period-year-select"
                value={activeAno}
                onChange={(e) =>
                  onChangePeriod(Number(e.target.value), activeMes)
                }
                className="bg-transparent text-sm font-semibold text-[var(--text-primary)] px-2 py-1.5 font-mono-nums focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Próximo mês"
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* JSON Export, Multi-File Import & Reset / Modo Amigo */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={onExportPeriodJson}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border-[1.5px] border-[var(--card-income-border)] bg-[var(--card-income-bg)] hover:opacity-90 text-[var(--text-primary)] text-xs sm:text-sm font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download
                className="w-4 h-4 text-[var(--semantic-income)] shrink-0"
                aria-hidden="true"
              />
              <span>Exportar JSON do Período</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Selecionar arquivos JSON para importar"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] hover:opacity-90 text-[var(--text-primary)] text-xs sm:text-sm font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload
                className="w-4 h-4 text-[var(--accent-blue)] shrink-0"
                aria-hidden="true"
              />
              <span>Importar JSON(s)</span>
            </button>

            <button
              type="button"
              onClick={onOpenResetModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] hover:opacity-90 text-[var(--text-primary)] text-xs sm:text-sm font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw
                className="w-4 h-4 text-[var(--accent-gold)] shrink-0"
                aria-hidden="true"
              />
              <span>Limpar / Modo Zero</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

