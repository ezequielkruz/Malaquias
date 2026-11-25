import type {
  BankAccount,
  CategoryConfig,
  CreditCardConfig,
  FinanceStore,
  PeriodExportPayload,
  PeriodSnapshot,
  Transaction,
  TransactionType,
} from '../types/finance';
import { DEFAULT_BANKS, DEFAULT_CREDIT_CARDS } from '../data/defaults';
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
      const parcelaInfo =
        tx.parcelaAtual && tx.totalParcelas
          ? `${tx.parcelaAtual}/${tx.totalParcelas}`
          : '';
      const hay = `${tx.descricao} ${tx.obs} ${tx.categoria} ${tx.titular} ${tx.data} ${tx.cartaoNome || ''} ${parcelaInfo}`.toLowerCase();
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
  cartoes: CreditCardConfig[] = [],
): PeriodExportPayload {
  return {
    schemaVersion: '1.0',
    periodo: snapshot.periodoKey,
    exportadoEm: new Date().toISOString(),
    transacoes: snapshot.lancamentos,
    bancos: snapshot.bancos,
    categorias,
    cartoes,
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
  cartoes?: CreditCardConfig[];
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
  const baseCartoes = Array.isArray(currentStore.cartoes)
    ? currentStore.cartoes
    : DEFAULT_CREDIT_CARDS;
  const nextCartoes: CreditCardConfig[] = baseCartoes.map((c) => ({ ...c }));

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

      // Merge imported cartoes block without duplicating by id or normalized name
      if (Array.isArray(parsed.cartoes)) {
        for (const impCard of parsed.cartoes) {
          if (!impCard || typeof impCard.nome !== 'string') continue;
          const cleanName = impCard.nome.trim();
          if (!cleanName) continue;
          const dueDay = Math.min(
            Math.max(Math.round(Number(impCard.diaVencimento) || 10), 1),
            31,
          );
          const existingCard = nextCartoes.find(
            (c) =>
              (impCard.id && c.id === impCard.id) ||
              c.nome.toLowerCase() === cleanName.toLowerCase(),
          );
          if (!existingCard) {
            nextCartoes.push({
              id: impCard.id || generateId('cc'),
              nome: cleanName,
              diaVencimento: dueDay,
            });
          } else {
            existingCard.nome = cleanName;
            existingCard.diaVencimento = dueDay;
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

        const baseTx: Transaction = {
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

        if (tx.cartaoId) baseTx.cartaoId = String(tx.cartaoId);
        if (tx.cartaoNome) baseTx.cartaoNome = String(tx.cartaoNome);
        if (typeof tx.parcelaAtual === 'number') baseTx.parcelaAtual = tx.parcelaAtual;
        if (typeof tx.totalParcelas === 'number') baseTx.totalParcelas = tx.totalParcelas;
        if (tx.parcelamentoGrupoId) {
          baseTx.parcelamentoGrupoId = String(tx.parcelamentoGrupoId);
        }

        return baseTx;
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
      cartoes: nextCartoes,
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

  // Single-payment (1x) preserves standard single transaction behavior
  if (!isCC || n === 1) {
    const cleanVal = Math.round((Number(input.valor) || 0) * 100) / 100;
    const singleObs =
      isCC && input.card
        ? trimmedObs
          ? `${trimmedObs} · ${input.card.nome}`
          : input.card.nome
        : trimmedObs;

    const singleTx: Omit<Transaction, 'id'> = {
      data: input.data,
      mes: baseMes,
      ano: baseAno,
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

  const dueDay = input.card ? input.card.diaVencimento : baseDia;
  const startOffset =
    typeof input.primeiraParcelaOffset === 'number'
      ? input.primeiraParcelaOffset
      : getDefaultFirstInstallmentStart(baseAno, baseMes, baseDia, dueDay).isNextMonth
        ? 1
        : 0;
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

  // Insert in reverse so items[0] ends up ahead in chronological/creation order when prepending,
  // or prepend per period in order. Grouping by period and prepending preserves installment order.
  const byPeriod = new Map<string, Transaction[]>();
  for (const item of items) {
    const key = getPeriodKey(item.ano, item.mes);
    const existingList = byPeriod.get(key) || [];
    existingList.push({ ...item, id: generateId('tx') });
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

