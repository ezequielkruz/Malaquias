import type {
  BankAccount,
  CategoryConfig,
  CreditCardConfig,
  FinanceStore,
  FullBackupExportPayload,
  PeriodExportPayload,
  PeriodSnapshot,
  Transaction,
  TransactionType,
} from '../types/finance';
import { DEFAULT_BANKS, DEFAULT_CREDIT_CARDS } from '../data/defaults';
import {
  computeDeterministicTransactionId,
  generateId,
  getPeriodKey,
  MONTH_ABBR,
  parseBRDate,
  toTimestampMs,
} from './format';

export interface CategoryBreakdownItem {
  categoria: string;
  valor: number;
  percentual: number;
  count: number;
}

export interface DashboardSummary {
  totalReceitas: number;
  totalDespesas: number;
  saldoMes: number;
  totalPIXD: number;
  totalCC: number;
  totalPIXR: number;
  totalPorForma: Record<string, number>;
  despesasPorCategoria: CategoryBreakdownItem[];
  patrimonioInvestido: number;
  patrimonioLiquidoTotal: number;
}

export interface BankCalculatedMetrics {
  liquidez: number;
  investidoECripto: number;
  faturaDeduction: number;
  subtotalLiquido: number;
}

export interface ConsolidatedBanksSummary {
  totalSaldoConta: number;
  totalComprometido: number;
  totalCaixinhas: number;
  totalLiquidez: number;
  totalInvestimentos: number;
  totalCripto: number;
  totalInvestidoECripto: number;
  totalFaturaCC: number;
  totalDividendos: number;
  patrimonioLiquidoTotal: number;
}

export function computeBankMetrics(bank: BankAccount): BankCalculatedMetrics {
  const liquidez =
    (bank.saldoConta || 0) -
    (bank.descontoComprometido || 0) +
    (bank.caixinhaCofrinho || 0);
  const investidoECripto = (bank.investimentos || 0) + (bank.criptomoedas || 0);
  const faturaDeduction = Math.abs(bank.faturaCC || 0);
  const subtotalLiquido = liquidez + investidoECripto - faturaDeduction;

  return {
    liquidez,
    investidoECripto,
    faturaDeduction,
    subtotalLiquido,
  };
}

export function computeConsolidatedBanks(banks: BankAccount[]): ConsolidatedBanksSummary {
  return banks.reduce<ConsolidatedBanksSummary>(
    (acc, bank) => {
      const m = computeBankMetrics(bank);
      acc.totalSaldoConta += bank.saldoConta || 0;
      acc.totalComprometido += bank.descontoComprometido || 0;
      acc.totalCaixinhas += bank.caixinhaCofrinho || 0;
      acc.totalLiquidez += m.liquidez;
      acc.totalInvestimentos += bank.investimentos || 0;
      acc.totalCripto += bank.criptomoedas || 0;
      acc.totalInvestidoECripto += m.investidoECripto;
      acc.totalFaturaCC += m.faturaDeduction;
      acc.totalDividendos += bank.dividendosRecebidos || 0;
      acc.patrimonioLiquidoTotal += m.subtotalLiquido;
      return acc;
    },
    {
      totalSaldoConta: 0,
      totalComprometido: 0,
      totalCaixinhas: 0,
      totalLiquidez: 0,
      totalInvestimentos: 0,
      totalCripto: 0,
      totalInvestidoECripto: 0,
      totalFaturaCC: 0,
      totalDividendos: 0,
      patrimonioLiquidoTotal: 0,
    },
  );
}

export function computeDashboardSummary(
  transactions: Transaction[],
  banks: BankAccount[],
  titularFilter = 'Todos',
): DashboardSummary {
  const filtered =
    titularFilter === 'Todos'
      ? transactions
      : transactions.filter(
          (t) => t.titular.toLowerCase() === titularFilter.toLowerCase(),
        );

  let totalReceitas = 0;
  let totalDespesas = 0;
  const totalPorForma: Record<string, number> = {};
  const expenseByCat: Record<string, { valor: number; count: number }> = {};

  for (const tx of filtered) {
    const val = Number(tx.valor) || 0;
    const forma = (tx.formaPagamento || 'OUTRO').toUpperCase();
    totalPorForma[forma] = (totalPorForma[forma] || 0) + val;

    if (tx.tipo === 'RECEITA') {
      totalReceitas += val;
    } else {
      totalDespesas += val;
      const cat = tx.categoria || 'OUTROS';
      if (!expenseByCat[cat]) {
        expenseByCat[cat] = { valor: 0, count: 0 };
      }
      expenseByCat[cat].valor += val;
      expenseByCat[cat].count += 1;
    }
  }

  const despesasPorCategoria: CategoryBreakdownItem[] = Object.entries(expenseByCat)
    .map(([categoria, data]) => ({
      categoria,
      valor: data.valor,
      count: data.count,
      percentual: totalDespesas > 0 ? (data.valor / totalDespesas) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  const bankTotals = computeConsolidatedBanks(banks);

  return {
    totalReceitas,
    totalDespesas,
    saldoMes: totalReceitas - totalDespesas,
    totalPIXD: totalPorForma['PIXD'] || 0,
    totalCC: totalPorForma['CC'] || 0,
    totalPIXR: totalPorForma['PIXR'] || 0,
    totalPorForma,
    despesasPorCategoria,
    patrimonioInvestido: bankTotals.totalInvestidoECripto,
    patrimonioLiquidoTotal: bankTotals.patrimonioLiquidoTotal,
  };
}

export interface TransactionFilters {
  search?: string;
  tipo?: 'TODOS' | TransactionType;
  categoria?: string;
  formaPagamento?: string;
  titular?: string;
}

export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const searchNorm = normalizeSearchText(filters.search || '');

  return transactions.filter((tx) => {
    if (filters.tipo && filters.tipo !== 'TODOS' && tx.tipo !== filters.tipo) {
      return false;
    }
    if (
      filters.categoria &&
      filters.categoria !== 'TODAS' &&
      tx.categoria !== filters.categoria
    ) {
      return false;
    }
    if (
      filters.formaPagamento &&
      filters.formaPagamento !== 'TODAS' &&
      tx.formaPagamento !== filters.formaPagamento
    ) {
      return false;
    }
    if (
      filters.titular &&
      filters.titular !== 'Todos' &&
      normalizeSearchText(tx.titular) !== normalizeSearchText(filters.titular)
    ) {
      return false;
    }
    if (searchNorm) {
      const parcelaInfo =
        tx.parcelaAtual && tx.totalParcelas
          ? `${tx.parcelaAtual}/${tx.totalParcelas}`
          : '';
      const periodTag = `${MONTH_ABBR[tx.mes - 1] || ''}/${tx.ano}`;
      const hay = normalizeSearchText(
        `${tx.descricao} ${tx.obs} ${tx.categoria} ${tx.formaPagamento} ${tx.titular} ${tx.data} ${periodTag} ${tx.cartaoNome || ''} ${parcelaInfo}`,
      );
      if (!hay.includes(searchNorm)) {
        return false;
      }
    }
    return true;
  });
}

export function collectAllPeriodTransactions(
  periods: Record<string, PeriodSnapshot>,
): Transaction[] {
  const all: Transaction[] = [];
  for (const snap of Object.values(periods)) {
    if (snap && Array.isArray(snap.lancamentos)) {
      all.push(...snap.lancamentos);
    }
  }

  return all.sort((a, b) => {
    if (a.ano !== b.ano) return b.ano - a.ano;
    if (a.mes !== b.mes) return b.mes - a.mes;
    const pa = parseBRDate(a.data);
    const pb = parseBRDate(b.data);
    const dayA = pa.isValid ? pa.dia : 0;
    const dayB = pb.isValid ? pb.dia : 0;
    return dayB - dayA;
  });
}

export function saveTransactionInStore(
  prev: FinanceStore,
  txData: Omit<Transaction, 'id'>,
  existingId?: string,
): { nextStore: FinanceStore; targetKey: string; movedFromKey: string | null } {
  const targetKey = getPeriodKey(txData.ano, txData.mes);
  const nextPeriods = { ...prev.periods };
  let movedFromKey: string | null = null;
  const nowIso = new Date().toISOString();

  if (existingId) {
    for (const [periodKey, snap] of Object.entries(nextPeriods)) {
      if (
        periodKey !== targetKey &&
        snap.lancamentos.some((t) => t.id === existingId)
      ) {
        movedFromKey = periodKey;
        nextPeriods[periodKey] = {
          ...snap,
          lancamentos: snap.lancamentos.filter((t) => t.id !== existingId),
        };
      }
    }
  }

  const targetSnap = getOrCreatePeriodSnapshot(
    { ...prev, periods: nextPeriods },
    txData.ano,
    txData.mes,
  );

  const nextLancamentos = existingId
    ? targetSnap.lancamentos.some((t) => t.id === existingId)
      ? targetSnap.lancamentos.map((t) =>
          t.id === existingId ? { ...txData, id: existingId, updatedAt: nowIso } : t,
        )
      : [{ ...txData, id: existingId, updatedAt: nowIso }, ...targetSnap.lancamentos]
    : [{ ...txData, id: generateId('tx'), updatedAt: nowIso }, ...targetSnap.lancamentos];

  nextPeriods[targetKey] = {
    ...targetSnap,
    lancamentos: nextLancamentos,
  };

  return {
    nextStore: {
      ...prev,
      periods: nextPeriods,
    },
    targetKey,
    movedFromKey,
  };
}

export function deleteTransactionFromStore(
  prev: FinanceStore,
  id: string,
): FinanceStore {
  let changed = false;
  const nextPeriods: Record<string, PeriodSnapshot> = { ...prev.periods };

  for (const [periodKey, snap] of Object.entries(nextPeriods)) {
    if (snap.lancamentos.some((t) => t.id === id)) {
      changed = true;
      nextPeriods[periodKey] = {
        ...snap,
        lancamentos: snap.lancamentos.filter((t) => t.id !== id),
      };
    }
  }

  if (!changed) return prev;
  return {
    ...prev,
    periods: nextPeriods,
  };
}

export interface AnnualSubcategoryRow {
  subcategoria: string;
  months: number[]; // length 12, index 0 = JAN
  total: number;
}

export interface AnnualCategoryGroup {
  categoria: string;
  tipo: TransactionType;
  months: number[]; // length 12
  total: number;
  subcategories: AnnualSubcategoryRow[];
}

export interface AnnualPivotResult {
  ano: number;
  receitasGroups: AnnualCategoryGroup[];
  despesasGroups: AnnualCategoryGroup[];
  totalReceitasMonths: number[];
  totalReceitasAno: number;
  totalDespesasMonths: number[];
  totalDespesasAno: number;
  saldoMonths: number[];
  saldoAno: number;
}

export function computeAnnualPivot(
  periods: Record<string, PeriodSnapshot>,
  categories: CategoryConfig[],
  ano: number,
): AnnualPivotResult {
  // Collect all transactions for the target year across all stored periods
  const yearTransactions: Transaction[] = [];
  for (const snap of Object.values(periods)) {
    if (snap.ano === ano) {
      yearTransactions.push(...snap.lancamentos);
    } else {
      // Also capture any transaction whose date/ano matches even if stored in another bucket
      for (const tx of snap.lancamentos) {
        if (tx.ano === ano) {
          yearTransactions.push(tx);
        }
      }
    }
  }

  // Deduplicate by tx.id just in case
  const seenIds = new Set<string>();
  const uniqueTx = yearTransactions.filter((tx) => {
    if (seenIds.has(tx.id)) return false;
    seenIds.add(tx.id);
    return true;
  });

  // Build map: tipo -> categoria -> subcategoria -> 12 months array
  const groupMap = new Map<string, AnnualCategoryGroup>();

  const ensureGroup = (categoria: string, tipo: TransactionType): AnnualCategoryGroup => {
    const key = `${tipo}::${categoria}`;
    let grp = groupMap.get(key);
    if (!grp) {
      grp = {
        categoria,
        tipo,
        months: Array(12).fill(0),
        total: 0,
        subcategories: [],
      };
      groupMap.set(key, grp);
    }
    return grp;
  };

  // Pre-seed groups from configured categories so the pivot stays complete and structured
  for (const cat of categories) {
    const grp = ensureGroup(cat.nome, cat.tipo);
    for (const sub of cat.subcategorias) {
      if (!grp.subcategories.some((s) => s.subcategoria === sub)) {
        grp.subcategories.push({
          subcategoria: sub,
          months: Array(12).fill(0),
          total: 0,
        });
      }
    }
  }

  const totalReceitasMonths = Array(12).fill(0);
  const totalDespesasMonths = Array(12).fill(0);

  for (const tx of uniqueTx) {
    const monthIndex = Math.min(Math.max((tx.mes || 1) - 1, 0), 11);
    const val = Number(tx.valor) || 0;
    const grp = ensureGroup(tx.categoria || 'OUTROS', tx.tipo);

    let subRow = grp.subcategories.find((s) => s.subcategoria === tx.descricao);
    if (!subRow) {
      subRow = {
        subcategoria: tx.descricao || 'Outros',
        months: Array(12).fill(0),
        total: 0,
      };
      grp.subcategories.push(subRow);
    }

    subRow.months[monthIndex] += val;
    subRow.total += val;
    grp.months[monthIndex] += val;
    grp.total += val;

    if (tx.tipo === 'RECEITA') {
      totalReceitasMonths[monthIndex] += val;
    } else {
      totalDespesasMonths[monthIndex] += val;
    }
  }

  const receitasGroups: AnnualCategoryGroup[] = [];
  const despesasGroups: AnnualCategoryGroup[] = [];

  for (const grp of groupMap.values()) {
    if (grp.tipo === 'RECEITA') {
      receitasGroups.push(grp);
    } else {
      despesasGroups.push(grp);
    }
  }

  const totalReceitasAno = totalReceitasMonths.reduce((a, b) => a + b, 0);
  const totalDespesasAno = totalDespesasMonths.reduce((a, b) => a + b, 0);
  const saldoMonths = totalReceitasMonths.map((r, idx) => r - totalDespesasMonths[idx]);
  const saldoAno = totalReceitasAno - totalDespesasAno;

  return {
    ano,
    receitasGroups,
    despesasGroups,
    totalReceitasMonths,
    totalReceitasAno,
    totalDespesasMonths,
    totalDespesasAno,
    saldoMonths,
    saldoAno,
  };
}

export function getOrCreatePeriodSnapshot(
  store: FinanceStore,
  ano: number,
  mes: number,
): PeriodSnapshot {
  const key = getPeriodKey(ano, mes);
  if (store.periods[key]) {
    return store.periods[key];
  }

  // Carry forward banks from nearest existing period or default template
  const existingKeys = Object.keys(store.periods).sort();
  let templateBanks: BankAccount[] = DEFAULT_BANKS;
  if (existingKeys.length > 0) {
    const latest = store.periods[existingKeys[existingKeys.length - 1]];
    if (latest?.bancos?.length > 0) {
      templateBanks = latest.bancos;
    }
  }

  return {
    periodoKey: key,
    ano,
    mes,
    lancamentos: [],
    bancos: templateBanks.map((b) => ({
      ...b,
      id: generateId('bank'),
    })),
    metas: {},
  };
}

export interface BankHistoryPoint {
  periodoKey: string; // "YYYY-MM"
  ano: number;
  mes: number;
  patrimonioInvestido: number;
  patrimonioLiquido: number;
  liquidez: number;
}

export function computeBankHistory(
  periods: Record<string, PeriodSnapshot>,
): BankHistoryPoint[] {
  return Object.values(periods)
    .filter((snap) => Array.isArray(snap.bancos) && snap.bancos.length > 0)
    .sort((a, b) => a.periodoKey.localeCompare(b.periodoKey))
    .map((snap) => {
      const consolidated = computeConsolidatedBanks(snap.bancos);
      return {
        periodoKey: snap.periodoKey,
        ano: snap.ano,
        mes: snap.mes,
        patrimonioInvestido: consolidated.totalInvestidoECripto,
        patrimonioLiquido: consolidated.patrimonioLiquidoTotal,
        liquidez: consolidated.totalLiquidez,
      };
    });
}

export function normalizeAndMigrateStore(
  store: FinanceStore,
  migrationIso = new Date().toISOString(),
): { store: FinanceStore; changed: boolean } {
  let changed = false;

  const nextCartoes: CreditCardConfig[] = (
    Array.isArray(store.cartoes) ? store.cartoes : DEFAULT_CREDIT_CARDS
  ).map((c) => {
    const id = c.id || generateId('cc');
    const updatedAt = c.updatedAt || migrationIso;
    if (id !== c.id || updatedAt !== c.updatedAt) changed = true;
    return { ...c, id, updatedAt };
  });
  if (!Array.isArray(store.cartoes)) changed = true;

  const nextCategories: CategoryConfig[] = (
    Array.isArray(store.categorias) ? store.categorias : []
  ).map((cat) => {
    const id = cat.id || generateId('cat');
    const updatedAt = cat.updatedAt || migrationIso;
    if (id !== cat.id || updatedAt !== cat.updatedAt) changed = true;
    return {
      ...cat,
      id,
      updatedAt,
      subcategorias: Array.isArray(cat.subcategorias) ? [...cat.subcategorias] : ['Outros'],
    };
  });

  const nextPeriods: Record<string, PeriodSnapshot> = {};
  for (const [key, snap] of Object.entries(store.periods || {})) {
    if (!snap || typeof snap !== 'object') continue;

    const seenTxIds = new Set<string>();
    const nextLancamentos: Transaction[] = [];
    for (const tx of Array.isArray(snap.lancamentos) ? snap.lancamentos : []) {
      const id =
        tx.id && String(tx.id).trim()
          ? String(tx.id).trim()
          : computeDeterministicTransactionId({
              data: tx.data,
              descricao: tx.descricao,
              valor: tx.valor,
              tipo: tx.tipo,
              cartaoNome: tx.cartaoNome,
              formaPagamento: tx.formaPagamento,
            });
      if (seenTxIds.has(id)) {
        changed = true;
        continue;
      }
      seenTxIds.add(id);
      const updatedAt = tx.updatedAt || migrationIso;
      if (id !== tx.id || updatedAt !== tx.updatedAt) changed = true;
      nextLancamentos.push({ ...tx, id, updatedAt });
    }

    const nextBancos: BankAccount[] = (
      Array.isArray(snap.bancos) ? snap.bancos : []
    ).map((bank) => {
      const id = bank.id || generateId('bank');
      const updatedAt = bank.updatedAt || migrationIso;
      if (id !== bank.id || updatedAt !== bank.updatedAt) changed = true;
      return { ...bank, id, updatedAt };
    });

    nextPeriods[key] = {
      ...snap,
      lancamentos: nextLancamentos,
      bancos: nextBancos,
      metas: snap.metas || {},
    };
  }

  return {
    store: changed
      ? {
          ...store,
          version: store.version || '3.10',
          periods: nextPeriods,
          categorias: nextCategories,
          cartoes: nextCartoes,
        }
      : store,
    changed,
  };
}

export function buildPeriodExportPayload(
  snapshot: PeriodSnapshot,
  categorias: CategoryConfig[] = [],
  cartoes: CreditCardConfig[] = [],
): PeriodExportPayload {
  const exportedAt = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    appVersion: '3.10',
    exportType: 'period',
    exportedAt,
    periodo: snapshot.periodoKey,
    exportadoEm: exportedAt,
    transacoes: snapshot.lancamentos.map((tx) => ({
      ...tx,
      id:
        tx.id ||
        computeDeterministicTransactionId({
          data: tx.data,
          descricao: tx.descricao,
          valor: tx.valor,
          tipo: tx.tipo,
          cartaoNome: tx.cartaoNome,
          formaPagamento: tx.formaPagamento,
        }),
      updatedAt: tx.updatedAt || exportedAt,
    })),
    bancos: snapshot.bancos.map((b) => ({
      ...b,
      id: b.id || generateId('bank'),
      updatedAt: b.updatedAt || exportedAt,
    })),
    categorias: categorias.map((c) => ({
      ...c,
      id: c.id || generateId('cat'),
      updatedAt: c.updatedAt || exportedAt,
    })),
    cartoes: cartoes.map((c) => ({
      ...c,
      id: c.id || generateId('cc'),
      updatedAt: c.updatedAt || exportedAt,
    })),
    metas: snapshot.metas,
  };
}

export function buildFullBackupExportPayload(
  store: FinanceStore,
): FullBackupExportPayload {
  const exportedAt = new Date().toISOString();
  const normalized = normalizeAndMigrateStore(store, exportedAt).store;

  const exportedPeriods: Record<string, PeriodSnapshot> = {};
  for (const [key, snap] of Object.entries(normalized.periods)) {
    exportedPeriods[key] = {
      ...snap,
      lancamentos: snap.lancamentos.map((tx) => ({ ...tx })),
      bancos: snap.bancos.map((b) => ({ ...b })),
      metas: { ...(snap.metas || {}) },
    };
  }

  return {
    schemaVersion: '2.0',
    appVersion: '3.10',
    exportType: 'full',
    exportedAt,
    exportadoEm: exportedAt,
    activeAno: normalized.activeAno,
    activeMes: normalized.activeMes,
    periods: exportedPeriods,
    categorias: normalized.categorias.map((c) => ({
      ...c,
      subcategorias: [...c.subcategorias],
    })),
    titulares: [...normalized.titulares],
    formasPagamento: [...normalized.formasPagamento],
    cartoes: normalized.cartoes.map((c) => ({ ...c })),
  };
}

export interface ImportSummaryResult {
  nextStore: FinanceStore;
  importedPeriods: string[];
  importedTransactionsCount: number;
  addedCount: number;
  updatedCount: number;
  ignoredCount: number;
  errors: string[];
}

interface LegacyOrStandardImportPayload {
  schemaVersion?: string;
  appVersion?: string;
  version?: string;
  exportType?: 'full' | 'period' | string;
  periodo?: string;
  exportadoEm?: string;
  exportedAt?: string;
  ano?: number;
  mes?: number;
  activeAno?: number;
  activeMes?: number;
  periods?: Record<string, PeriodSnapshot>;
  transacoes?: Array<Transaction & { banco?: string }>;
  lancamentos?: Array<Transaction & { banco?: string }>;
  bancos?: BankAccount[];
  categorias?: CategoryConfig[];
  titulares?: string[];
  formasPagamento?: string[];
  cartoes?: CreditCardConfig[];
  metas?: PeriodSnapshot['metas'];
}

function parsePeriodoField(
  parsed: Pick<LegacyOrStandardImportPayload, 'periodo' | 'ano' | 'mes'>,
): { ano: number; mes: number; isValid: boolean } {
  if (typeof parsed.periodo === 'string') {
    const m = /^(\d{4})-(\d{2})$/.exec(parsed.periodo.trim());
    if (m) {
      const ano = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10);
      if (mes >= 1 && mes <= 12 && ano >= 1900 && ano <= 2100) {
        return { ano, mes, isValid: true };
      }
    }
  }
  if (
    typeof parsed.ano === 'number' &&
    typeof parsed.mes === 'number' &&
    parsed.mes >= 1 &&
    parsed.mes <= 12
  ) {
    return { ano: parsed.ano, mes: parsed.mes, isValid: true };
  }
  return { ano: 2026, mes: 1, isValid: false };
}

function mergeCategoryList(
  targetCategories: CategoryConfig[],
  incomingCategories: CategoryConfig[] | undefined,
): void {
  if (!Array.isArray(incomingCategories)) return;

  for (const impCat of incomingCategories) {
    if (!impCat || typeof impCat.nome !== 'string') continue;
    const catTipo: TransactionType = impCat.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA';
    const catName = impCat.nome.trim();
    if (!catName) continue;

    const subs = Array.isArray(impCat.subcategorias)
      ? impCat.subcategorias.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const existingCat = targetCategories.find(
      (c) =>
        (impCat.id && c.id === impCat.id) ||
        (c.nome.toUpperCase() === catName.toUpperCase() && c.tipo === catTipo),
    );

    if (!existingCat) {
      const uniqueSubs: string[] = [];
      const seenSubNorm = new Set<string>();
      for (const s of subs) {
        const norm = s.toLowerCase();
        if (!seenSubNorm.has(norm)) {
          seenSubNorm.add(norm);
          uniqueSubs.push(s);
        }
      }
      targetCategories.push({
        id: impCat.id || generateId('cat'),
        updatedAt: impCat.updatedAt || new Date().toISOString(),
        nome: catName,
        tipo: catTipo,
        subcategorias: uniqueSubs.length > 0 ? uniqueSubs : ['Outros'],
      });
    } else {
      const existingSubNorm = new Set(
        existingCat.subcategorias.map((s) => s.trim().toLowerCase()),
      );
      for (const sub of subs) {
        if (!existingSubNorm.has(sub.toLowerCase())) {
          existingSubNorm.add(sub.toLowerCase());
          existingCat.subcategorias.push(sub);
        }
      }
      const impTs = toTimestampMs(impCat.updatedAt);
      const curTs = toTimestampMs(existingCat.updatedAt);
      if (impTs > curTs && impCat.updatedAt) {
        existingCat.updatedAt = impCat.updatedAt;
      }
    }
  }
}

function mergeCreditCardList(
  targetCartoes: CreditCardConfig[],
  incomingCartoes: CreditCardConfig[] | undefined,
): void {
  if (!Array.isArray(incomingCartoes)) return;

  for (const impCard of incomingCartoes) {
    if (!impCard || typeof impCard.nome !== 'string') continue;
    const cleanName = impCard.nome.trim();
    if (!cleanName) continue;
    const dueDay = Math.min(
      Math.max(Math.round(Number(impCard.diaVencimento) || 10), 1),
      31,
    );
    const existingCard = targetCartoes.find(
      (c) =>
        (impCard.id && c.id === impCard.id) ||
        c.nome.toLowerCase() === cleanName.toLowerCase(),
    );
    if (!existingCard) {
      targetCartoes.push({
        id: impCard.id || generateId('cc'),
        updatedAt: impCard.updatedAt || new Date().toISOString(),
        nome: cleanName,
        diaVencimento: dueDay,
      });
    } else {
      const impTs = toTimestampMs(impCard.updatedAt);
      const curTs = toTimestampMs(existingCard.updatedAt);
      if (impTs > curTs || (!existingCard.updatedAt && !impCard.updatedAt)) {
        existingCard.nome = cleanName;
        existingCard.diaVencimento = dueDay;
        if (impCard.updatedAt) existingCard.updatedAt = impCard.updatedAt;
      }
    }
  }
}

function mergeBanksSnapshot(
  existingBanks: BankAccount[] | undefined,
  incomingBanks: BankAccount[] | undefined,
): BankAccount[] {
  const result: BankAccount[] = (existingBanks || []).map((b) => ({ ...b }));
  if (!Array.isArray(incomingBanks) || incomingBanks.length === 0) {
    return result.length > 0 ? result : DEFAULT_BANKS.map((b) => ({ ...b }));
  }

  for (const imp of incomingBanks) {
    if (!imp || typeof imp.nome !== 'string') continue;
    const cleanName = imp.nome.trim() || 'Banco';
    const existingIdx = result.findIndex(
      (b) =>
        (imp.id && b.id === imp.id) ||
        b.nome.trim().toLowerCase() === cleanName.toLowerCase(),
    );

    const sanitizedImp: BankAccount = {
      id: imp.id || generateId('bank'),
      updatedAt: imp.updatedAt,
      nome: cleanName,
      saldoConta: Number(imp.saldoConta) || 0,
      descontoComprometido: Number(imp.descontoComprometido) || 0,
      caixinhaCofrinho: Number(imp.caixinhaCofrinho) || 0,
      investimentos: Number(imp.investimentos) || 0,
      criptomoedas: Number(imp.criptomoedas) || 0,
      faturaCC: Number(imp.faturaCC) || 0,
      dividendosRecebidos: Number(imp.dividendosRecebidos) || 0,
    };

    if (existingIdx === -1) {
      result.push({
        ...sanitizedImp,
        updatedAt: sanitizedImp.updatedAt || new Date().toISOString(),
      });
    } else {
      const existingBank = result[existingIdx];
      const impTs = toTimestampMs(sanitizedImp.updatedAt);
      const curTs = toTimestampMs(existingBank.updatedAt);
      if (impTs > curTs) {
        result[existingIdx] = {
          ...sanitizedImp,
          id: existingBank.id,
        };
      }
    }
  }

  return result;
}

/**
 * Parses one or multiple JSON file payloads (single-period exports, legacy files,
 * or full multi-period backups) and performs smart ID + updatedAt merge into the
 * FinanceStore without duplicating transactions, banks, categories, or cards.
 */
export function parseAndMergeImportedPayloads(
  currentStore: FinanceStore,
  rawFiles: Array<{ name: string; content: string }>,
): ImportSummaryResult {
  const nowIso = new Date().toISOString();
  const nextPeriods: Record<string, PeriodSnapshot> = {};
  const globalTxPeriodById = new Map<string, string>();

  for (const [pKey, snap] of Object.entries(currentStore.periods)) {
    const clonedTxs = (snap.lancamentos || []).map((t) => {
      const txId =
        t.id && String(t.id).trim()
          ? String(t.id).trim()
          : computeDeterministicTransactionId({
              data: t.data,
              descricao: t.descricao,
              valor: t.valor,
              tipo: t.tipo,
              cartaoNome: t.cartaoNome,
              formaPagamento: t.formaPagamento,
            });
      globalTxPeriodById.set(txId, pKey);
      return { ...t, id: txId };
    });

    nextPeriods[pKey] = {
      ...snap,
      lancamentos: clonedTxs,
      bancos: (snap.bancos || []).map((b) => ({ ...b })),
      metas: { ...(snap.metas || {}) },
    };
  }

  const importedPeriodsSet = new Set<string>();
  let importedTransactionsCount = 0;
  let addedCount = 0;
  let updatedCount = 0;
  let ignoredCount = 0;
  const errors: string[] = [];

  const nextCategories = currentStore.categorias.map((c) => ({
    ...c,
    subcategorias: [...c.subcategorias],
  }));

  const nextTitularesMap = new Map<string, string>();
  for (const t of currentStore.titulares) {
    const clean = t.trim();
    if (clean) nextTitularesMap.set(clean.toLowerCase(), clean);
  }
  const nextFormasMap = new Map<string, string>();
  for (const f of currentStore.formasPagamento) {
    const clean = f.trim();
    if (clean) nextFormasMap.set(clean.toLowerCase(), clean);
  }

  const addTitularUnique = (name?: string) => {
    const clean = String(name || '').trim();
    if (clean && !nextTitularesMap.has(clean.toLowerCase())) {
      nextTitularesMap.set(clean.toLowerCase(), clean);
    }
  };
  const addFormaUnique = (name?: string) => {
    const clean = String(name || '').trim();
    if (clean && !nextFormasMap.has(clean.toLowerCase())) {
      nextFormasMap.set(clean.toLowerCase(), clean);
    }
  };

  const baseCartoes = Array.isArray(currentStore.cartoes)
    ? currentStore.cartoes
    : DEFAULT_CREDIT_CARDS;
  const nextCartoes: CreditCardConfig[] = baseCartoes.map((c) => ({ ...c }));

  const mergeSinglePeriodChunk = (chunk: {
    ano: number;
    mes: number;
    rawTransactions: Array<Transaction & { banco?: string }>;
    bancos?: BankAccount[];
    metas?: PeriodSnapshot['metas'];
  }) => {
    const { ano, mes, rawTransactions } = chunk;
    const chunkPeriodoKey = getPeriodKey(ano, mes);
    importedPeriodsSet.add(chunkPeriodoKey);

    if (!nextPeriods[chunkPeriodoKey]) {
      nextPeriods[chunkPeriodoKey] = {
        periodoKey: chunkPeriodoKey,
        ano,
        mes,
        lancamentos: [],
        bancos: mergeBanksSnapshot(undefined, chunk.bancos),
        metas: chunk.metas ? { ...chunk.metas } : {},
      };
    } else {
      nextPeriods[chunkPeriodoKey] = {
        ...nextPeriods[chunkPeriodoKey],
        bancos: mergeBanksSnapshot(nextPeriods[chunkPeriodoKey].bancos, chunk.bancos),
        metas: chunk.metas
          ? { ...nextPeriods[chunkPeriodoKey].metas, ...chunk.metas }
          : nextPeriods[chunkPeriodoKey].metas,
      };
    }

    for (const rawTx of rawTransactions) {
      if (!rawTx || typeof rawTx !== 'object') continue;

      const parsedDate = parseBRDate(rawTx.data || '');
      const txMes = parsedDate.isValid ? parsedDate.mes : rawTx.mes || mes;
      const txAno = parsedDate.isValid ? parsedDate.ano : rawTx.ano || ano;
      const tipo: TransactionType = rawTx.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA';
      const catName = String(rawTx.categoria || 'OUTROS').trim();
      const descName = String(rawTx.descricao || 'Outros').trim();
      const titularName = String(rawTx.titular || 'ezequiel').trim();
      const formaName = String(rawTx.formaPagamento || 'PIXD').trim();
      const valorNum = Number(rawTx.valor) || 0;
      const formattedData =
        rawTx.data && String(rawTx.data).trim()
          ? String(rawTx.data).trim()
          : `01/${String(txMes).padStart(2, '0')}/${txAno}`;

      let catObj = nextCategories.find(
        (c) => c.nome.toUpperCase() === catName.toUpperCase() && c.tipo === tipo,
      );
      if (!catObj) {
        catObj = {
          id: generateId('cat'),
          updatedAt: nowIso,
          nome: catName,
          tipo,
          subcategorias: [descName],
        };
        nextCategories.push(catObj);
      } else if (
        descName &&
        !catObj.subcategorias.some((s) => s.toLowerCase() === descName.toLowerCase())
      ) {
        catObj.subcategorias.push(descName);
      }

      addTitularUnique(titularName);
      addFormaUnique(formaName);

      const hasExplicitId = Boolean(rawTx.id && String(rawTx.id).trim());
      const resolvedId = hasExplicitId
        ? String(rawTx.id).trim()
        : computeDeterministicTransactionId({
            data: formattedData,
            descricao: descName,
            valor: valorNum,
            tipo,
            banco: rawTx.banco,
            cartaoNome: rawTx.cartaoNome,
            formaPagamento: formaName,
          });

      const incomingTs = toTimestampMs(rawTx.updatedAt);
      const hasIncomingUpdatedAt = incomingTs > 0;

      const normalizedIncoming: Transaction = {
        id: resolvedId,
        updatedAt: hasIncomingUpdatedAt ? String(rawTx.updatedAt) : nowIso,
        data: formattedData,
        mes: txMes,
        ano: txAno,
        tipo,
        categoria: catObj.nome,
        descricao: descName,
        valor: valorNum,
        obs: String(rawTx.obs || ''),
        formaPagamento: formaName,
        titular: titularName,
        ...(rawTx.cartaoId ? { cartaoId: String(rawTx.cartaoId) } : {}),
        ...(rawTx.cartaoNome ? { cartaoNome: String(rawTx.cartaoNome) } : {}),
        ...(typeof rawTx.parcelaAtual === 'number' ? { parcelaAtual: rawTx.parcelaAtual } : {}),
        ...(typeof rawTx.totalParcelas === 'number' ? { totalParcelas: rawTx.totalParcelas } : {}),
        ...(rawTx.parcelamentoGrupoId
          ? { parcelamentoGrupoId: String(rawTx.parcelamentoGrupoId) }
          : {}),
      };

      const targetKey = getPeriodKey(txAno, txMes);
      importedPeriodsSet.add(targetKey);
      importedTransactionsCount += 1;

      if (!nextPeriods[targetKey]) {
        nextPeriods[targetKey] = {
          periodoKey: targetKey,
          ano: txAno,
          mes: txMes,
          lancamentos: [],
          bancos: mergeBanksSnapshot(undefined, chunk.bancos),
          metas: {},
        };
      }

      const existingPeriodKey = globalTxPeriodById.get(resolvedId);
      if (!existingPeriodKey) {
        nextPeriods[targetKey].lancamentos.push(normalizedIncoming);
        globalTxPeriodById.set(resolvedId, targetKey);
        addedCount += 1;
        continue;
      }

      const existingBucket = nextPeriods[existingPeriodKey];
      const existingTx = existingBucket?.lancamentos.find((t) => t.id === resolvedId);
      if (!existingTx) {
        nextPeriods[targetKey].lancamentos.push(normalizedIncoming);
        globalTxPeriodById.set(resolvedId, targetKey);
        addedCount += 1;
        continue;
      }

      const existingTs = toTimestampMs(existingTx.updatedAt);

      // Keep existing if incoming lacks updatedAt or is older/same timestamp
      if (!hasIncomingUpdatedAt || incomingTs <= existingTs) {
        ignoredCount += 1;
        continue;
      }

      // Incoming has strictly newer updatedAt -> update (and move period if changed)
      if (existingPeriodKey === targetKey) {
        nextPeriods[targetKey] = {
          ...nextPeriods[targetKey],
          lancamentos: nextPeriods[targetKey].lancamentos.map((t) =>
            t.id === resolvedId ? normalizedIncoming : t,
          ),
        };
      } else {
        nextPeriods[existingPeriodKey] = {
          ...nextPeriods[existingPeriodKey],
          lancamentos: nextPeriods[existingPeriodKey].lancamentos.filter(
            (t) => t.id !== resolvedId,
          ),
        };
        nextPeriods[targetKey] = {
          ...nextPeriods[targetKey],
          lancamentos: [...nextPeriods[targetKey].lancamentos, normalizedIncoming],
        };
        globalTxPeriodById.set(resolvedId, targetKey);
      }
      updatedCount += 1;
    }
  };

  for (const file of rawFiles) {
    try {
      const parsed = JSON.parse(file.content) as LegacyOrStandardImportPayload;
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push(
          `Arquivo "${file.name}" não possui o formato válido do Gestor Financeiro.`,
        );
        continue;
      }

      // Merge top-level auxiliary lists first
      mergeCategoryList(nextCategories, parsed.categorias);
      mergeCreditCardList(nextCartoes, parsed.cartoes);
      if (Array.isArray(parsed.titulares)) {
        for (const t of parsed.titulares) addTitularUnique(t);
      }
      if (Array.isArray(parsed.formasPagamento)) {
        for (const f of parsed.formasPagamento) addFormaUnique(f);
      }

      // Case 1: Full backup payload (exportType === 'full' or periods dictionary)
      if (
        (parsed.exportType === 'full' || (parsed.periods && typeof parsed.periods === 'object')) &&
        parsed.periods &&
        !Array.isArray(parsed.periods)
      ) {
        const periodEntries = Object.entries(parsed.periods);
        if (periodEntries.length === 0) {
          errors.push(`Backup "${file.name}" não contém períodos válidos.`);
          continue;
        }

        for (const [rawKey, snap] of periodEntries) {
          if (!snap || typeof snap !== 'object') continue;
          const periodInfo = parsePeriodoField({
            periodo: snap.periodoKey || rawKey,
            ano: snap.ano,
            mes: snap.mes,
          });
          if (!periodInfo.isValid) continue;

          const rawTxs = Array.isArray(snap.lancamentos)
            ? snap.lancamentos
            : [];
          mergeSinglePeriodChunk({
            ano: periodInfo.ano,
            mes: periodInfo.mes,
            rawTransactions: rawTxs,
            bancos: snap.bancos,
            metas: snap.metas,
          });
        }
        continue;
      }

      // Case 2: Single period export (standard or legacy)
      const periodInfo = parsePeriodoField(parsed);
      const rawTransactions = Array.isArray(parsed.transacoes)
        ? parsed.transacoes
        : Array.isArray(parsed.lancamentos)
          ? parsed.lancamentos
          : null;

      if (!periodInfo.isValid || rawTransactions === null) {
        errors.push(
          `Arquivo "${file.name}" não possui o formato válido do Gestor Financeiro.`,
        );
        continue;
      }

      mergeSinglePeriodChunk({
        ano: periodInfo.ano,
        mes: periodInfo.mes,
        rawTransactions,
        bancos: parsed.bancos,
        metas: parsed.metas,
      });
    } catch {
      errors.push(`Erro ao ler JSON de "${file.name}".`);
    }
  }

  const importedPeriods = Array.from(importedPeriodsSet).sort();
  let activeAno = currentStore.activeAno;
  let activeMes = currentStore.activeMes;
  if (importedPeriods.length === 1) {
    const [y, m] = importedPeriods[0].split('-').map(Number);
    if (y && m) {
      activeAno = y;
      activeMes = m;
    }
  }

  return {
    nextStore: {
      ...currentStore,
      activeAno,
      activeMes,
      periods: nextPeriods,
      categorias: nextCategories,
      titulares: Array.from(nextTitularesMap.values()),
      formasPagamento: Array.from(nextFormasMap.values()),
      cartoes: nextCartoes,
    },
    importedPeriods,
    importedTransactionsCount,
    addedCount,
    updatedCount,
    ignoredCount,
    errors,
  };
}

/**
 * Clears transactions (`lancamentos`) from either the active period only
 * or all periods, while keeping Categories, Titulares, Formas de Pagamento,
 * and Bank balances completely intact.
 */
export function clearStoreTransactions(
  store: FinanceStore,
  scope: 'active' | 'all' = 'all',
): FinanceStore {
  const activeKey = getPeriodKey(store.activeAno, store.activeMes);
  const nextPeriods: Record<string, PeriodSnapshot> = {};

  for (const [key, snap] of Object.entries(store.periods)) {
    if (scope === 'all' || key === activeKey) {
      nextPeriods[key] = {
        ...snap,
        lancamentos: [],
      };
    } else {
      nextPeriods[key] = snap;
    }
  }

  // Ensure active period exists cleanly with 0 transactions
  if (!nextPeriods[activeKey]) {
    const activeSnap = getOrCreatePeriodSnapshot(store, store.activeAno, store.activeMes);
    nextPeriods[activeKey] = {
      ...activeSnap,
      lancamentos: [],
    };
  }

  return {
    ...store,
    periods: nextPeriods,
  };
}

/**
 * Fresh-start / "Modo Amigo" reset:
 * - Deletes all transactions across all periods
 * - Zeroes out all monetary fields (R$ 0,00) in Bancos & Investimentos while keeping institution names
 * - Preserves Categorias, Subcategorias, Titulares, and Formas de Pagamento intact
 */
export function resetStoreForFreshStart(store: FinanceStore): FinanceStore {
  const activeKey = getPeriodKey(store.activeAno, store.activeMes);
  const activeSnap = getOrCreatePeriodSnapshot(store, store.activeAno, store.activeMes);
  const sourceBanks =
    activeSnap.bancos.length > 0 ? activeSnap.bancos : DEFAULT_BANKS;

  const zeroedActiveBanks: BankAccount[] = sourceBanks.map((bank) => ({
    id: bank.id || generateId('bank'),
    nome: bank.nome,
    saldoConta: 0,
    descontoComprometido: 0,
    caixinhaCofrinho: 0,
    investimentos: 0,
    criptomoedas: 0,
    faturaCC: 0,
    dividendosRecebidos: 0,
  }));

  return {
    ...store,
    periods: {
      [activeKey]: {
        periodoKey: activeKey,
        ano: store.activeAno,
        mes: store.activeMes,
        lancamentos: [],
        bancos: zeroedActiveBanks,
        metas: {},
      },
    },
  };
}

export type InstallmentValueMode = 'TOTAL' | 'PARCELA';

export function clampDayToMonth(ano: number, mes: number, dia: number): number {
  const safeDay = Math.max(1, Math.min(31, Math.round(dia)));
  const maxDayInMonth = new Date(ano, mes, 0).getDate();
  return Math.min(safeDay, maxDayInMonth);
}

export function addMonthsToYearMonth(
  ano: number,
  mes: number,
  offset: number,
): { ano: number; mes: number } {
  const totalMonths = ano * 12 + (mes - 1) + offset;
  return {
    ano: Math.floor(totalMonths / 12),
    mes: (((totalMonths % 12) + 12) % 12) + 1,
  };
}

export function getDefaultFirstInstallmentStart(
  purchaseAno: number,
  purchaseMes: number,
  purchaseDia: number,
  dueDay: number,
): { ano: number; mes: number; isNextMonth: boolean } {
  if (purchaseDia > dueDay) {
    const next = addMonthsToYearMonth(purchaseAno, purchaseMes, 1);
    return { ano: next.ano, mes: next.mes, isNextMonth: true };
  }
  return { ano: purchaseAno, mes: purchaseMes, isNextMonth: false };
}

export function splitAmountIntoInstallments(
  amount: number,
  installments: number,
  mode: InstallmentValueMode,
): number[] {
  const n = Math.max(1, Math.min(24, Math.round(installments)));
  const rawCents = Math.max(0, Math.round((Number(amount) || 0) * 100));

  if (mode === 'PARCELA' || n === 1) {
    const unitValue = rawCents / 100;
    return Array.from({ length: n }, () => unitValue);
  }

  const baseCents = Math.floor(rawCents / n);
  const remainderCents = rawCents - baseCents * n;

  return Array.from({ length: n }, (_, idx) => {
    const cents = baseCents + (idx < remainderCents ? 1 : 0);
    return cents / 100;
  });
}

export interface BuildInstallmentPlanInput {
  data: string;
  tipo: TransactionType;
  categoria: string;
  descricao: string;
  valor: number;
  obs: string;
  formaPagamento: string;
  titular: string;
  card: CreditCardConfig | null;
  parcelas: number;
  valorModo: InstallmentValueMode;
  primeiraParcelaOffset?: 0 | 1; // 0 = same month as purchase, 1 = next month
}

export interface InstallmentPlanResult {
  items: Array<Omit<Transaction, 'id'>>;
  totalValor: number;
  valorParcelaBase: number;
}

export function buildInstallmentPlan(
  input: BuildInstallmentPlanInput,
): InstallmentPlanResult {
  const parsed = parseBRDate(input.data);
  const baseAno = parsed.isValid ? parsed.ano : new Date().getFullYear();
  const baseMes = parsed.isValid ? parsed.mes : new Date().getMonth() + 1;
  const baseDia = parsed.isValid ? parsed.dia : 1;
  const n = Math.max(1, Math.min(24, Math.round(input.parcelas || 1)));
  const trimmedObs = input.obs.trim();
  const isCC = input.formaPagamento.trim().toUpperCase() === 'CC';

  const dueDay = input.card ? input.card.diaVencimento : baseDia;
  const startOffset = isCC
    ? typeof input.primeiraParcelaOffset === 'number'
      ? input.primeiraParcelaOffset
      : getDefaultFirstInstallmentStart(baseAno, baseMes, baseDia, dueDay).isNextMonth
        ? 1
        : 0
    : 0;

  // Single-payment (1x) preserves single-transaction behavior while honoring CC due-day competence routing
  if (!isCC || n === 1) {
    const cleanVal = Math.round((Number(input.valor) || 0) * 100) / 100;
    const singleObs =
      isCC && input.card
        ? trimmedObs
          ? `${trimmedObs} · ${input.card.nome}`
          : input.card.nome
        : trimmedObs;

    const targetYM = isCC
      ? addMonthsToYearMonth(baseAno, baseMes, startOffset)
      : { ano: baseAno, mes: baseMes };
    const singleDate =
      isCC && startOffset > 0
        ? `${String(clampDayToMonth(targetYM.ano, targetYM.mes, dueDay)).padStart(2, '0')}/${String(targetYM.mes).padStart(2, '0')}/${targetYM.ano}`
        : input.data;

    const singleTx: Omit<Transaction, 'id'> = {
      data: singleDate,
      mes: targetYM.mes,
      ano: targetYM.ano,
      tipo: input.tipo,
      categoria: input.categoria,
      descricao: input.descricao,
      valor: cleanVal,
      obs: singleObs,
      formaPagamento: input.formaPagamento,
      titular: input.titular,
      ...(isCC && input.card
        ? {
            cartaoId: input.card.id,
            cartaoNome: input.card.nome,
          }
        : {}),
    };

    return {
      items: [singleTx],
      totalValor: cleanVal,
      valorParcelaBase: cleanVal,
    };
  }

  const startYM = addMonthsToYearMonth(baseAno, baseMes, startOffset);
  const amounts = splitAmountIntoInstallments(input.valor, n, input.valorModo);
  const groupId = generateId('parc');

  const items: Array<Omit<Transaction, 'id'>> = amounts.map((val, idx) => {
    const targetYM = addMonthsToYearMonth(startYM.ano, startYM.mes, idx);
    const alignedDay = clampDayToMonth(targetYM.ano, targetYM.mes, dueDay);
    const formattedDate = `${String(alignedDay).padStart(2, '0')}/${String(targetYM.mes).padStart(2, '0')}/${targetYM.ano}`;
    const parcelaTag = `${idx + 1}/${n}`;
    const cardTag = input.card
      ? `${input.card.nome} (${parcelaTag})`
      : `Parcela ${parcelaTag}`;
    const fullObs = trimmedObs ? `${trimmedObs} · ${cardTag}` : cardTag;

    return {
      data: formattedDate,
      mes: targetYM.mes,
      ano: targetYM.ano,
      tipo: input.tipo,
      categoria: input.categoria,
      descricao: input.descricao,
      valor: val,
      obs: fullObs,
      formaPagamento: input.formaPagamento,
      titular: input.titular,
      cartaoId: input.card?.id,
      cartaoNome: input.card?.nome,
      parcelaAtual: idx + 1,
      totalParcelas: n,
      parcelamentoGrupoId: groupId,
    };
  });

  const totalCents = amounts.reduce((sum, v) => sum + Math.round(v * 100), 0);
  return {
    items,
    totalValor: totalCents / 100,
    valorParcelaBase: amounts[amounts.length - 1] ?? 0,
  };
}

export function addTransactionsBatchToStore(
  store: FinanceStore,
  items: Array<Omit<Transaction, 'id'>>,
): FinanceStore {
  if (items.length === 0) return store;

  const nextPeriods = { ...store.periods };
  const nowIso = new Date().toISOString();

  // Insert in reverse so items[0] ends up ahead in chronological/creation order when prepending,
  // or prepend per period in order. Grouping by period and prepending preserves installment order.
  const byPeriod = new Map<string, Transaction[]>();
  for (const item of items) {
    const key = getPeriodKey(item.ano, item.mes);
    const existingList = byPeriod.get(key) || [];
    existingList.push({ ...item, id: generateId('tx'), updatedAt: nowIso });
    byPeriod.set(key, existingList);
  }

  for (const [key, newTxs] of byPeriod.entries()) {
    const sample = newTxs[0];
    const targetSnap = getOrCreatePeriodSnapshot(
      { ...store, periods: nextPeriods },
      sample.ano,
      sample.mes,
    );
    nextPeriods[key] = {
      ...targetSnap,
      lancamentos: [...newTxs, ...targetSnap.lancamentos],
    };
  }

  return {
    ...store,
    periods: nextPeriods,
  };
}

export interface CumulativePeriodPoint {
  periodoKey: string; // "YYYY-MM"
  ano: number;
  mes: number;
  receitas: number;
  despesas: number;
  saldoMes: number;
  saldoAcumulado: number;
  despesasCount: number;
  parcelasCount: number;
  status: 'historico' | 'atual' | 'futuro';
}

export interface CumulativeAndFutureOverview {
  activeKey: string;
  saldoAcumuladoAnterior: number;
  saldoMesAtual: number;
  saldoAcumuladoAtePeriodo: number;
  periodosAteAtualCount: number;
  receitasAcumuladasAtePeriodo: number;
  despesasAcumuladasAtePeriodo: number;
  despesasFuturasTotal: number;
  receitasFuturasTotal: number;
  despesasFuturasCount: number;
  parcelasFuturasCount: number;
  mesesFuturosCount: number;
  proximoMesComDespesa: {
    periodoKey: string;
    ano: number;
    mes: number;
    valor: number;
  } | null;
  timeline: CumulativePeriodPoint[];
}

export function computeCumulativeAndFutureOverview(
  periods: Record<string, PeriodSnapshot>,
  activeAno: number,
  activeMes: number,
  titularFilter = 'Todos',
): CumulativeAndFutureOverview {
  const activeKey = getPeriodKey(activeAno, activeMes);

  // Deduplicate transactions across all stored periods by tx.id
  const seenIds = new Set<string>();
  const allTransactions: Transaction[] = [];
  for (const snap of Object.values(periods)) {
    for (const tx of snap.lancamentos) {
      if (seenIds.has(tx.id)) continue;
      seenIds.add(tx.id);
      if (
        titularFilter !== 'Todos' &&
        tx.titular.toLowerCase() !== titularFilter.toLowerCase()
      ) {
        continue;
      }
      allTransactions.push(tx);
    }
  }

  interface Bucket {
    ano: number;
    mes: number;
    receitas: number;
    despesas: number;
    despesasCount: number;
    parcelasCount: number;
  }

  const buckets = new Map<string, Bucket>();
  buckets.set(activeKey, {
    ano: activeAno,
    mes: activeMes,
    receitas: 0,
    despesas: 0,
    despesasCount: 0,
    parcelasCount: 0,
  });

  for (const tx of allTransactions) {
    const key = getPeriodKey(tx.ano, tx.mes);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ano: tx.ano,
        mes: tx.mes,
        receitas: 0,
        despesas: 0,
        despesasCount: 0,
        parcelasCount: 0,
      };
      buckets.set(key, bucket);
    }

    const val = Number(tx.valor) || 0;
    if (tx.tipo === 'RECEITA') {
      bucket.receitas += val;
    } else {
      bucket.despesas += val;
      bucket.despesasCount += 1;
      if (tx.parcelaAtual && tx.totalParcelas && tx.totalParcelas > 1) {
        bucket.parcelasCount += 1;
      }
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  let runningSaldoAcumulado = 0;
  let saldoAcumuladoAnterior = 0;
  let saldoMesAtual = 0;
  let periodosAteAtualCount = 0;
  let receitasAcumuladasAtePeriodo = 0;
  let despesasAcumuladasAtePeriodo = 0;
  let despesasFuturasTotal = 0;
  let receitasFuturasTotal = 0;
  let despesasFuturasCount = 0;
  let parcelasFuturasCount = 0;
  let mesesFuturosCount = 0;
  let proximoMesComDespesa: CumulativeAndFutureOverview['proximoMesComDespesa'] =
    null;

  const timeline: CumulativePeriodPoint[] = [];

  for (const key of sortedKeys) {
    const b = buckets.get(key)!;
    const saldoMes = b.receitas - b.despesas;
    runningSaldoAcumulado += saldoMes;

    const status: CumulativePeriodPoint['status'] =
      key < activeKey ? 'historico' : key === activeKey ? 'atual' : 'futuro';

    if (status === 'historico') {
      saldoAcumuladoAnterior += saldoMes;
    } else if (status === 'atual') {
      saldoMesAtual = saldoMes;
    }

    if (key <= activeKey) {
      periodosAteAtualCount += 1;
      receitasAcumuladasAtePeriodo += b.receitas;
      despesasAcumuladasAtePeriodo += b.despesas;
    } else {
      despesasFuturasTotal += b.despesas;
      receitasFuturasTotal += b.receitas;
      despesasFuturasCount += b.despesasCount;
      parcelasFuturasCount += b.parcelasCount;
      if (b.despesas > 0) {
        mesesFuturosCount += 1;
        if (!proximoMesComDespesa) {
          proximoMesComDespesa = {
            periodoKey: key,
            ano: b.ano,
            mes: b.mes,
            valor: b.despesas,
          };
        }
      }
    }

    timeline.push({
      periodoKey: key,
      ano: b.ano,
      mes: b.mes,
      receitas: b.receitas,
      despesas: b.despesas,
      saldoMes,
      saldoAcumulado: runningSaldoAcumulado,
      despesasCount: b.despesasCount,
      parcelasCount: b.parcelasCount,
      status,
    });
  }

  return {
    activeKey,
    saldoAcumuladoAnterior,
    saldoMesAtual,
    saldoAcumuladoAtePeriodo: saldoAcumuladoAnterior + saldoMesAtual,
    periodosAteAtualCount,
    receitasAcumuladasAtePeriodo,
    despesasAcumuladasAtePeriodo,
    despesasFuturasTotal,
    receitasFuturasTotal,
    despesasFuturasCount,
    parcelasFuturasCount,
    mesesFuturosCount,
    proximoMesComDespesa,
    timeline,
  };
}


