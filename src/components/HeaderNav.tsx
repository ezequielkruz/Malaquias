import React, { useRef } from 'react';
import {
  Archive,
  ArrowLeftRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Landmark,
  Mic,
  Palette,
  PieChart,
  Plus,
  RotateCcw,
  Tags,
  Upload,
} from 'lucide-react';
import type { TabId } from '../types/finance';
import { MONTH_ABBR } from '../utils/format';
import { THEME_OPTIONS, type ThemeId } from '../utils/theme';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenNewTransaction: () => void;
  onOpenVoiceTransaction?: () => void;
  activeAno: number;
  activeMes: number;
  availableYears: number[];
  onChangePeriod: (ano: number, mes: number) => void;
  onExportPeriodJson: () => void;
  onExportFullBackupJson: () => void;
  onImportJsonFiles: (files: File[] | FileList) => void;
  onOpenResetModal: () => void;
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
}

const TABS: Array<{
  id: TabId;
  label: string;
  mobileLabel: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { id: 'resumo', label: 'Resumo do Mês', mobileLabel: 'Resumo', Icon: PieChart },
  { id: 'controle', label: 'Controle', mobileLabel: 'Controle', Icon: ArrowLeftRight },
  { id: 'bancos', label: 'Bancos & Investimentos', mobileLabel: 'Bancos', Icon: Landmark },
  { id: 'anual', label: 'Orçamento Anual', mobileLabel: 'Anual', Icon: CalendarRange },
  { id: 'categorias', label: 'Categorias', mobileLabel: 'Categorias', Icon: Tags },
];

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTransaction,
  onOpenVoiceTransaction,
  activeAno,
  activeMes,
  availableYears,
  onChangePeriod,
  onExportPeriodJson,
  onExportFullBackupJson,
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
      const selectedFiles = Array.from(e.target.files);
      e.target.value = '';
      onImportJsonFiles(selectedFiles);
    }
  };

  return (
    <>
      <header className="app-top-header border-b border-[var(--border-subtle)] bg-[var(--bg-header)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 lg:py-0 lg:h-16 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-4">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span
              aria-hidden="true"
              className="app-brand-dot w-2.5 h-2.5 rounded-sm bg-[var(--accent-gold)] ring-2 ring-[var(--accent-blue)]/30"
            />
            <span className="app-brand-title font-display text-base lg:text-[15px] xl:text-base font-bold tracking-tight text-[var(--text-primary)]">
              Gestor Financeiro 3.10
            </span>
          </div>

          {/* Zone 2: Primary Tabs (Desktop) */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-3 xl:gap-4 2xl:gap-5"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-5 text-xs xl:text-[13px] 2xl:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none ${
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

          {/* Zone 3: Theme Selector + PWA Install + Voice Shortcut + Primary Action */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0">
            <div className="app-theme-pill flex items-center gap-1.5 border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] rounded-lg px-2 sm:px-2.5 py-1.5 min-w-0 flex-1 sm:flex-initial sm:max-w-[155px] 2xl:max-w-[185px] overflow-hidden">
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
                className="bg-transparent text-xs font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer w-full min-w-0 truncate"
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <PWAInstallButton />

            {onOpenVoiceTransaction && (
              <button
                type="button"
                onClick={onOpenVoiceTransaction}
                aria-label="Lançamento por voz"
                title="Lançamento por voz"
                className="inline-flex items-center justify-center p-2 2xl:px-3 2xl:py-2 rounded-lg border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] hover:opacity-90 text-[var(--text-primary)] text-xs sm:text-sm font-semibold transition-opacity shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-underline)]"
              >
                <Mic className="w-4 h-4 text-[var(--accent-gold)] shrink-0" aria-hidden="true" />
                <span className="hidden 2xl:inline ml-1.5">Voz</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-underline)]"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Novo Lançamento</span>
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Touch-Friendly Icon + Label Grid Navigation (min 48px touch target, zero accidental cutoffs) */}
        <nav
          aria-label="Navegação móvel"
          className="app-mobile-nav lg:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/55 px-2.5 sm:px-6 py-2"
        >
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`app-mobile-tab relative min-h-[52px] sm:min-h-[46px] px-1 sm:px-2.5 py-1.5 rounded-lg border-[1.5px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-underline)] ${
                    isActive
                      ? 'border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] text-[var(--text-primary)] font-bold [box-shadow:var(--card-shadow)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <TabIcon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[var(--accent-gold)]' : 'text-[var(--accent-blue)]'
                    }`}
                    aria-hidden={true}
                  />
                  <span className="text-[10px] sm:text-xs leading-tight tracking-tight truncate max-w-full">
                    <span className="sm:hidden">{tab.mobileLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t bg-[var(--accent-underline)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Workspace Period & JSON Portability Bar */}
      <div className="app-period-bar border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
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

          {/* JSON Export, Full Backup, Multi-File Import & Reset / Modo Amigo */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center lg:justify-end gap-2 w-full lg:w-auto">
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

            <button
              type="button"
              onClick={onExportFullBackupJson}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border-[1.5px] border-[var(--accent-underline)]/55 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-xs sm:text-sm font-semibold transition-colors text-center sm:whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Archive
                className="w-4 h-4 text-[var(--accent-gold)] shrink-0"
                aria-hidden="true"
              />
              <span>Exportar Backup Completo (Todos os Períodos)</span>
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

