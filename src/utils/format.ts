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

export function formatFullBackupFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `gestor_financeiro_3_10_backup_${y}-${m}-${d}.json`;
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
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const randA = Math.random().toString(36).slice(2, 10);
  const randB = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randA}${randB}`;
}

export function toTimestampMs(value?: string | number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && /^\d+$/.test(value.trim())) {
      return asNum;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Generates a deterministic synchronous hash ID for legacy imported transactions
 * missing an `id`, based on data + descricao + valor + tipo + banco.
 */
export function computeDeterministicTransactionId(fields: {
  data?: string;
  descricao?: string;
  valor?: number;
  tipo?: string;
  banco?: string;
  cartaoNome?: string;
  formaPagamento?: string;
}): string {
  const norm = (v?: string) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const bancoRef = norm(fields.banco || fields.cartaoNome || fields.formaPagamento);
  const canonical = [
    norm(fields.data),
    norm(fields.descricao),
    (Number(fields.valor) || 0).toFixed(2),
    norm(fields.tipo || 'DESPESA'),
    bancoRef,
  ].join('|');

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + ((i + 1) & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `tx_hash_${hex1}${hex2}`;
}

