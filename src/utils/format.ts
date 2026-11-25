export const MONTH_ABBR = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

export const MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export function getPeriodKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function formatPeriodLabel(ano: number, mes: number): string {
  const abbr = MONTH_ABBR[mes - 1] ?? 'JAN';
  return `${abbr} / ${ano}`;
}

export function formatExportFilename(ano: number, mes: number): string {
  return `financas_${ano}_${String(mes).padStart(2, '0')}.json`;
}

export function formatBRL(value: number, showSign = false): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safeVal));

  if (safeVal < 0) {
    return `-${formatted}`;
  }
  if (showSign && safeVal > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Formats a raw number into masked currency input string (e.g., 1234.56 -> "1.234,56")
 */
export function formatNumberAsBRMask(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Parses a user-typed currency string (like "R$ 1.250,50" or "125050" in centavos mode) into a number.
 * When `digitsOnlyCents` is true, strips non-digits and treats last 2 digits as decimal cents.
 */
export function parseCurrencyMaskInput(raw: string, allowNegative = false): number {
  const isNeg = allowNegative && raw.trim().startsWith('-');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const cents = parseInt(digits, 10);
  const val = cents / 100;
  return isNeg ? -val : val;
}

/**
 * Parses a formatted decimal or integer string (e.g., "1.234,56" or "1234.56")
 */
export function parseFlexibleBRL(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return 0;
  // If contains comma, assume pt-BR: dots are thousands, comma is decimal
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Validates and parses DD/MM/AAAA date string into { mes, ano, isValid }.
 */
export function parseBRDate(dateStr: string): {
  dia: number;
  mes: number;
  ano: number;
  isValid: boolean;
} {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr.trim());
  if (!match) {
    return { dia: 1, mes: 1, ano: 2026, isValid: false };
  }
  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const ano = parseInt(match[3], 10);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2100) {
    return { dia, mes, ano, isValid: false };
  }
  const dt = new Date(ano, mes - 1, dia);
  const isValid =
    dt.getFullYear() === ano && dt.getMonth() === mes - 1 && dt.getDate() === dia;

  return { dia, mes, ano, isValid };
}

/**
 * Masks raw input digits into DD/MM/AAAA
 */
export function maskBRDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function getDefaultDateForPeriod(ano: number, mes: number, dia = 1): string {
  const d = String(Math.min(Math.max(dia, 1), 28)).padStart(2, '0');
  const m = String(mes).padStart(2, '0');
  return `${d}/${m}/${ano}`;
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
