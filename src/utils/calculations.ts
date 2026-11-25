import type {
  BankAccount,
  CategoryConfig,
  FinanceStore,
  PeriodExportPayload,
  PeriodSnapshot,
  Transaction,
  TransactionType,
} from '../types/finance';
import { DEFAULT_BANKS } from '../data/defaults';
import { generateId, getPeriodKey, parseBRDate } from './format';

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

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const searchLower = (filters.search || '').trim().toLowerCase();

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
      tx.titular.toLowerCase() !== filters.titular.toLowerCase()
    ) {
      return false;
    }
    if (searchLower) {
      const hay = `${tx.descricao} ${tx.obs} ${tx.categoria} ${tx.titular} ${tx.data}`.toLowerCase();
      if (!hay.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });
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

export function buildPeriodExportPayload(
  snapshot: PeriodSnapshot,
  categorias: CategoryConfig[] = [],
): PeriodExportPayload {
  return {
    schemaVersion: '1.0',
    periodo: snapshot.periodoKey,
    exportadoEm: new Date().toISOString(),
    transacoes: snapshot.lancamentos,
    bancos: snapshot.bancos,
    categorias,
    metas: snapshot.metas,
  };
}

export interface ImportSummaryResult {
  nextStore: FinanceStore;
  importedPeriods: string[];
  importedTransactionsCount: number;
  errors: string[];
}

interface LegacyOrStandardImportPayload {
  schemaVersion?: string;
  version?: string;
  periodo?: string;
  exportadoEm?: string;
  exportedAt?: string;
  ano?: number;
  mes?: number;
  transacoes?: Transaction[];
  lancamentos?: Transaction[];
  bancos?: BankAccount[];
  categorias?: CategoryConfig[];
  metas?: PeriodSnapshot['metas'];
}

function parsePeriodoField(
  parsed: LegacyOrStandardImportPayload,
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

/**
 * Parses one or multiple JSON file payloads (from single or multi-file import)
 * and consolidates them into the FinanceStore without duplicating transactions (by id)
 * or bank snapshots (by YYYY-MM period).
 */
export function parseAndMergeImportedPayloads(
  currentStore: FinanceStore,
  rawFiles: Array<{ name: string; content: string }>,
): ImportSummaryResult {
  const nextPeriods: Record<string, PeriodSnapshot> = { ...currentStore.periods };
  const importedPeriodsSet = new Set<string>();
  let importedTransactionsCount = 0;
  const errors: string[] = [];

  const nextCategories = currentStore.categorias.map((c) => ({
    ...c,
    subcategorias: [...c.subcategorias],
  }));
  const nextTitulares = new Set(currentStore.titulares);
  const nextFormas = new Set(currentStore.formasPagamento);

  for (const file of rawFiles) {
    try {
      const parsed = JSON.parse(file.content) as LegacyOrStandardImportPayload;
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push(`Arquivo "${file.name}" não possui o formato válido do Gestor Financeiro.`);
        continue;
      }

      const periodInfo = parsePeriodoField(parsed);
      const rawTransactions = Array.isArray(parsed.transacoes)
        ? parsed.transacoes
        : Array.isArray(parsed.lancamentos)
          ? parsed.lancamentos
          : null;

      if (!periodInfo.isValid || rawTransactions === null) {
        errors.push(`Arquivo "${file.name}" não possui o formato válido do Gestor Financeiro.`);
        continue;
      }

      const { ano, mes } = periodInfo;
      const periodoKey = getPeriodKey(ano, mes);

      // Merge imported categorias block without duplicating categories or subcategories
      if (Array.isArray(parsed.categorias)) {
        for (const impCat of parsed.categorias) {
          if (!impCat || typeof impCat.nome !== 'string') continue;
          const catTipo: TransactionType = impCat.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA';
          const catName = impCat.nome.trim();
          const subs = Array.isArray(impCat.subcategorias)
            ? impCat.subcategorias.map((s) => String(s).trim()).filter(Boolean)
            : [];

          let existingCat = nextCategories.find(
            (c) => c.nome.toUpperCase() === catName.toUpperCase() && c.tipo === catTipo,
          );
          if (!existingCat) {
            existingCat = {
              id: impCat.id || generateId('cat'),
              nome: catName,
              tipo: catTipo,
              subcategorias: subs.length > 0 ? Array.from(new Set(subs)) : ['Outros'],
            };
            nextCategories.push(existingCat);
          } else {
            for (const sub of subs) {
              if (!existingCat.subcategorias.includes(sub)) {
                existingCat.subcategorias.push(sub);
              }
            }
          }
        }
      }

      const sanitizedLancamentos: Transaction[] = rawTransactions.map((tx) => {
        const parsedDate = parseBRDate(tx.data || '');
        const txMes = parsedDate.isValid ? parsedDate.mes : tx.mes || mes;
        const txAno = parsedDate.isValid ? parsedDate.ano : tx.ano || ano;
        const tipo: TransactionType = tx.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA';
        const catName = String(tx.categoria || 'OUTROS').trim();
        const descName = String(tx.descricao || 'Outros').trim();
        const titularName = String(tx.titular || 'ezequiel').trim();
        const formaName = String(tx.formaPagamento || 'PIXD').trim();

        let catObj = nextCategories.find(
          (c) => c.nome.toUpperCase() === catName.toUpperCase() && c.tipo === tipo,
        );
        if (!catObj) {
          catObj = {
            id: generateId('cat'),
            nome: catName,
            tipo,
            subcategorias: [descName],
          };
          nextCategories.push(catObj);
        } else if (descName && !catObj.subcategorias.includes(descName)) {
          catObj.subcategorias.push(descName);
        }

        if (titularName) nextTitulares.add(titularName);
        if (formaName) nextFormas.add(formaName);

        return {
          id: tx.id || generateId('tx'),
          data: tx.data || `01/${String(txMes).padStart(2, '0')}/${txAno}`,
          mes: txMes,
          ano: txAno,
          tipo,
          categoria: catObj.nome,
          descricao: descName,
          valor: Number(tx.valor) || 0,
          obs: String(tx.obs || ''),
          formaPagamento: formaName,
          titular: titularName,
        };
      });

      const existing = nextPeriods[periodoKey];
      // Always deduplicate transactions by unique `id` across existing and incoming
      const mergedMap = new Map<string, Transaction>();
      if (existing) {
        for (const t of existing.lancamentos) {
          mergedMap.set(t.id, t);
        }
      }
      for (const t of sanitizedLancamentos) {
        mergedMap.set(t.id, t);
      }

      // Deduplicate bank snapshot per period YYYY-MM (by id / normalized name)
      let incomingBanks: BankAccount[];
      if (Array.isArray(parsed.bancos) && parsed.bancos.length > 0) {
        const bankByKey = new Map<string, BankAccount>();
        for (const b of parsed.bancos) {
          const cleanName = String(b.nome || 'Banco').trim();
          const dedupKey = b.id || cleanName.toLowerCase();
          bankByKey.set(dedupKey, {
            id: b.id || generateId('bank'),
            nome: cleanName,
            saldoConta: Number(b.saldoConta) || 0,
            descontoComprometido: Number(b.descontoComprometido) || 0,
            caixinhaCofrinho: Number(b.caixinhaCofrinho) || 0,
            investimentos: Number(b.investimentos) || 0,
            criptomoedas: Number(b.criptomoedas) || 0,
            faturaCC: Number(b.faturaCC) || 0,
            dividendosRecebidos: Number(b.dividendosRecebidos) || 0,
          });
        }
        incomingBanks = Array.from(bankByKey.values());
      } else {
        incomingBanks = existing?.bancos || DEFAULT_BANKS;
      }

      nextPeriods[periodoKey] = {
        periodoKey,
        ano,
        mes,
        lancamentos: Array.from(mergedMap.values()),
        bancos: incomingBanks,
        metas: parsed.metas || existing?.metas || {},
      };

      importedPeriodsSet.add(periodoKey);
      importedTransactionsCount += sanitizedLancamentos.length;
    } catch {
      errors.push(`Erro ao ler JSON de "${file.name}".`);
    }
  }

  const importedPeriods = Array.from(importedPeriodsSet);
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
      titulares: Array.from(nextTitulares),
      formasPagamento: Array.from(nextFormas),
    },
    importedPeriods,
    importedTransactionsCount,
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

