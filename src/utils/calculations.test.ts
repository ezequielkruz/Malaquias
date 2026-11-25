import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTransactionsBatchToStore,
  buildInstallmentPlan,
  buildPeriodExportPayload,
  clampDayToMonth,
  clearStoreTransactions,
  computeAnnualPivot,
  computeBankHistory,
  computeBankMetrics,
  computeConsolidatedBanks,
  computeCumulativeAndFutureOverview,
  computeDashboardSummary,
  filterTransactions,
  getDefaultFirstInstallmentStart,
  parseAndMergeImportedPayloads,
  resetStoreForFreshStart,
  splitAmountIntoInstallments,
} from './calculations';
import {
  formatBRL,
  getPeriodKey,
  maskBRDateInput,
  parseBRDate,
  parseCurrencyMaskInput,
} from './format';
import {
  createInitialFinanceStore,
  DEFAULT_BANKS,
  DEFAULT_CATEGORIES,
  DEFAULT_CREDIT_CARDS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_TITULARES,
} from '../data/defaults';
import { isValidThemeId } from './theme';
import type { BankAccount, FinanceStore, Transaction } from '../types/finance';

function createSampleTestStore(): FinanceStore {
  const janBanks: BankAccount[] = [
    {
      id: 'bank_nubank_2026_1',
      nome: 'Nubank',
      saldoConta: 3000,
      descontoComprometido: 200,
      caixinhaCofrinho: 5000,
      investimentos: 10000,
      criptomoedas: 1000,
      faturaCC: 500,
      dividendosRecebidos: 100,
    },
    {
      id: 'bank_mp_2026_1',
      nome: 'Mercado Pago',
      saldoConta: 1000,
      descontoComprometido: 0,
      caixinhaCofrinho: 2000,
      investimentos: 3000,
      criptomoedas: 0,
      faturaCC: 200,
      dividendosRecebidos: 25,
    },
  ];

  const febBanks: BankAccount[] = [
    { ...janBanks[0], id: 'bank_nubank_2026_2', investimentos: 12000 },
    { ...janBanks[1], id: 'bank_mp_2026_2', investimentos: 3500 },
  ];

  return {
    version: '3.10',
    activeAno: 2026,
    activeMes: 2,
    periods: {
      '2026-01': {
        periodoKey: '2026-01',
        ano: 2026,
        mes: 1,
        lancamentos: [
          {
            id: 'tx_jan_1',
            data: '05/01/2026',
            mes: 1,
            ano: 2026,
            tipo: 'RECEITA',
            categoria: 'RECEITAS',
            descricao: 'Salário',
            valor: 7800,
            obs: 'Salário mensal',
            formaPagamento: 'PIXR',
            titular: 'ezequiel',
          },
        ],
        bancos: janBanks,
        metas: {},
      },
      '2026-02': {
        periodoKey: '2026-02',
        ano: 2026,
        mes: 2,
        lancamentos: [
          {
            id: 'tx_feb_1',
            data: '05/02/2026',
            mes: 2,
            ano: 2026,
            tipo: 'RECEITA',
            categoria: 'RECEITAS',
            descricao: 'Salário',
            valor: 7800,
            obs: 'Salário mensal',
            formaPagamento: 'PIXR',
            titular: 'ezequiel',
          },
          {
            id: 'tx_feb_2',
            data: '06/02/2026',
            mes: 2,
            ano: 2026,
            tipo: 'DESPESA',
            categoria: 'CASA',
            descricao: 'Aluguel',
            valor: 1950,
            obs: 'Aluguel',
            formaPagamento: 'PIXD',
            titular: 'ezequiel',
          },
        ],
        bancos: febBanks,
        metas: {},
      },
    },
    categorias: DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      subcategorias: [...c.subcategorias],
    })),
    titulares: [...DEFAULT_TITULARES],
    formasPagamento: [...DEFAULT_PAYMENT_METHODS],
    cartoes: DEFAULT_CREDIT_CARDS.map((c) => ({ ...c })),
  };
}

test('createInitialFinanceStore starts clean with zeroed transactions and bank balances while preserving structure', () => {
  const store = createInitialFinanceStore();
  const keys = Object.keys(store.periods);
  assert.equal(keys.length, 1);

  const initialPeriod = store.periods[keys[0]];
  assert.equal(initialPeriod.lancamentos.length, 0);
  assert.deepEqual(
    initialPeriod.bancos.map((b) => b.nome),
    DEFAULT_BANKS.map((b) => b.nome),
  );
  for (const bank of initialPeriod.bancos) {
    assert.equal(bank.saldoConta, 0);
    assert.equal(bank.descontoComprometido, 0);
    assert.equal(bank.caixinhaCofrinho, 0);
    assert.equal(bank.investimentos, 0);
    assert.equal(bank.criptomoedas, 0);
    assert.equal(bank.faturaCC, 0);
    assert.equal(bank.dividendosRecebidos, 0);
  }

  assert.equal(store.categorias.length, DEFAULT_CATEGORIES.length);
  assert.deepEqual(store.titulares, DEFAULT_TITULARES);
  assert.deepEqual(store.formasPagamento, DEFAULT_PAYMENT_METHODS);
  assert.deepEqual(
    store.cartoes.map((c) => c.nome),
    DEFAULT_CREDIT_CARDS.map((c) => c.nome),
  );
});

test('format & date helpers parse Brazilian dates and currency masks accurately', () => {
  assert.equal(parseCurrencyMaskInput('R$ 1.234,56'), 1234.56);
  assert.equal(parseCurrencyMaskInput('45000'), 450);
  assert.equal(maskBRDateInput('15022026'), '15/02/2026');

  const valid = parseBRDate('15/02/2026');
  assert.equal(valid.isValid, true);
  assert.equal(valid.mes, 2);
  assert.equal(valid.ano, 2026);

  const invalid = parseBRDate('31/02/2026');
  assert.equal(invalid.isValid, false);

  assert.equal(getPeriodKey(2026, 2), '2026-02');
  assert.match(formatBRL(1250.5), /1\.250,50/);
});

test('computeDashboardSummary calculates receitas, despesas, saldo, payment totals, and titular filter', () => {
  const txs: Transaction[] = [
    {
      id: '1',
      data: '05/02/2026',
      mes: 2,
      ano: 2026,
      tipo: 'RECEITA',
      categoria: 'RECEITAS',
      descricao: 'Salário',
      valor: 5000,
      obs: '',
      formaPagamento: 'PIXR',
      titular: 'ezequiel',
    },
    {
      id: '2',
      data: '06/02/2026',
      mes: 2,
      ano: 2026,
      tipo: 'DESPESA',
      categoria: 'CASA',
      descricao: 'Aluguel',
      valor: 1500,
      obs: '',
      formaPagamento: 'PIXD',
      titular: 'ezequiel',
    },
    {
      id: '3',
      data: '10/02/2026',
      mes: 2,
      ano: 2026,
      tipo: 'DESPESA',
      categoria: 'ALIMENTAÇÃO',
      descricao: 'Supermercado',
      valor: 500,
      obs: '',
      formaPagamento: 'CC',
      titular: 'familia',
    },
  ];

  const banks: BankAccount[] = [
    {
      id: 'b1',
      nome: 'Nubank',
      saldoConta: 2000,
      descontoComprometido: 200,
      caixinhaCofrinho: 3000,
      investimentos: 10000,
      criptomoedas: 2500,
      faturaCC: 500,
      dividendosRecebidos: 120,
    },
  ];

  const summaryAll = computeDashboardSummary(txs, banks, 'Todos');
  assert.equal(summaryAll.totalReceitas, 5000);
  assert.equal(summaryAll.totalDespesas, 2000);
  assert.equal(summaryAll.saldoMes, 3000);
  assert.equal(summaryAll.totalPIXD, 1500);
  assert.equal(summaryAll.totalCC, 500);
  assert.equal(summaryAll.totalPIXR, 5000);
  assert.equal(summaryAll.patrimonioInvestido, 12500);
  assert.equal(summaryAll.despesasPorCategoria.length, 2);
  assert.equal(summaryAll.despesasPorCategoria[0].categoria, 'CASA');
  assert.equal(summaryAll.despesasPorCategoria[0].percentual, 75);

  const summaryEzequiel = computeDashboardSummary(txs, banks, 'ezequiel');
  assert.equal(summaryEzequiel.totalReceitas, 5000);
  assert.equal(summaryEzequiel.totalDespesas, 1500);
  assert.equal(summaryEzequiel.saldoMes, 3500);
});

test('computeBankMetrics, computeConsolidatedBanks, and computeBankHistory track monthly snapshots', () => {
  const banks: BankAccount[] = [
    {
      id: 'b1',
      nome: 'Nubank',
      saldoConta: 3000,
      descontoComprometido: 500,
      caixinhaCofrinho: 2000,
      investimentos: 10000,
      criptomoedas: 1000,
      faturaCC: 800,
      dividendosRecebidos: 100,
    },
    {
      id: 'b2',
      nome: 'Mercado Pago',
      saldoConta: 1000,
      descontoComprometido: 0,
      caixinhaCofrinho: 500,
      investimentos: 2000,
      criptomoedas: 0,
      faturaCC: -200,
      dividendosRecebidos: 25,
    },
  ];

  const m1 = computeBankMetrics(banks[0]);
  assert.equal(m1.liquidez, 4500);
  assert.equal(m1.investidoECripto, 11000);
  assert.equal(m1.subtotalLiquido, 14700);

  const consolidated = computeConsolidatedBanks(banks);
  assert.equal(consolidated.totalLiquidez, 6000);
  assert.equal(consolidated.totalInvestidoECripto, 13000);
  assert.equal(consolidated.totalFaturaCC, 1000);
  assert.equal(consolidated.totalDividendos, 125);
  assert.equal(consolidated.patrimonioLiquidoTotal, 18000);

  const store = createSampleTestStore();
  const history = computeBankHistory(store.periods);
  assert.equal(history.length, 2);
  assert.equal(history[0].periodoKey, '2026-01');
  assert.equal(history[1].periodoKey, '2026-02');
  assert.ok(history[1].patrimonioInvestido > history[0].patrimonioInvestido);
  assert.ok(history[1].patrimonioLiquido > history[0].patrimonioLiquido);
});

test('computeAnnualPivot aggregates JAN-DEZ across periods and calculates category totals', () => {
  const store = createSampleTestStore();
  const pivot = computeAnnualPivot(store.periods, DEFAULT_CATEGORIES, 2026);

  assert.equal(pivot.ano, 2026);
  assert.equal(pivot.totalReceitasAno, 15600);
  assert.equal(pivot.totalDespesasAno, 1950);
  assert.equal(pivot.saldoAno, pivot.totalReceitasAno - pivot.totalDespesasAno);

  assert.equal(pivot.totalReceitasMonths[1], 7800);
  assert.equal(pivot.totalDespesasMonths[1], 1950);
});

test('standardized schemaVersion 1.0 export and multi-file import prevents duplicates by id and YYYY-MM', () => {
  const store = createSampleTestStore();
  const janPayload = buildPeriodExportPayload(store.periods['2026-01'], store.categorias);
  const febPayload = buildPeriodExportPayload(store.periods['2026-02'], store.categorias);

  // Verify standardized JSON root fields
  assert.equal(janPayload.schemaVersion, '1.0');
  assert.equal(janPayload.periodo, '2026-01');
  assert.ok(!Number.isNaN(Date.parse(janPayload.exportadoEm)));
  assert.ok(Array.isArray(janPayload.transacoes));
  assert.ok(Array.isArray(janPayload.bancos));
  assert.ok(Array.isArray(janPayload.categorias));

  // New April 2026 standardized payload
  const aprPayload = {
    schemaVersion: '1.0',
    periodo: '2026-04',
    exportadoEm: new Date().toISOString(),
    transacoes: [
      {
        id: 'tx_apr_custom',
        data: '12/04/2026',
        mes: 4,
        ano: 2026,
        tipo: 'DESPESA',
        categoria: 'LAZER',
        descricao: 'Parque Temático',
        valor: 380,
        obs: 'Ingresso família',
        formaPagamento: 'CC',
        titular: 'maria',
      },
    ],
    bancos: store.periods['2026-02'].bancos,
    categorias: [
      {
        id: 'cat_lazer',
        nome: 'LAZER',
        tipo: 'DESPESA',
        subcategorias: ['Parque Temático'],
      },
    ],
  };

  // Import same period & duplicate files in one batch + re-import again
  const initialJanCount = store.periods['2026-01'].lancamentos.length;
  const initialJanBankCount = store.periods['2026-01'].bancos.length;

  const firstImport = parseAndMergeImportedPayloads(store, [
    { name: 'financas_2026_01.json', content: JSON.stringify(janPayload) },
    { name: 'financas_2026_01_dup.json', content: JSON.stringify(janPayload) },
    { name: 'financas_2026_02.json', content: JSON.stringify(febPayload) },
    { name: 'financas_2026_04.json', content: JSON.stringify(aprPayload) },
  ]);

  assert.equal(firstImport.errors.length, 0);
  // Deduplicated periods count: 2026-01, 2026-02, 2026-04 -> 3
  assert.equal(firstImport.importedPeriods.length, 3);
  // No duplicate transactions in 2026-01
  assert.equal(
    firstImport.nextStore.periods['2026-01'].lancamentos.length,
    initialJanCount,
  );
  // No duplicate banks in 2026-01
  assert.equal(
    firstImport.nextStore.periods['2026-01'].bancos.length,
    initialJanBankCount,
  );
  // April imported properly
  assert.ok(firstImport.nextStore.periods['2026-04']);
  assert.equal(firstImport.nextStore.periods['2026-04'].lancamentos[0].valor, 380);
  assert.ok(firstImport.nextStore.titulares.includes('maria'));

  // Re-import April again — count must stay 1
  const secondImport = parseAndMergeImportedPayloads(firstImport.nextStore, [
    { name: 'financas_2026_04.json', content: JSON.stringify(aprPayload) },
  ]);
  assert.equal(secondImport.nextStore.periods['2026-04'].lancamentos.length, 1);
  assert.equal(
    secondImport.nextStore.periods['2026-04'].bancos.length,
    store.periods['2026-02'].bancos.length,
  );

  const lazerCat = secondImport.nextStore.categorias.find((c) => c.nome === 'LAZER');
  assert.ok(lazerCat?.subcategorias.includes('Parque Temático'));
  // Ensure no duplicate subcategory entries
  assert.equal(
    lazerCat?.subcategorias.filter((s) => s === 'Parque Temático').length,
    1,
  );

  const filtered = filterTransactions(secondImport.nextStore.periods['2026-04'].lancamentos, {
    search: 'Ingresso',
  });
  assert.equal(filtered.length, 1);
});

test('clearStoreTransactions removes transactions while keeping categories, people, and bank balances intact', () => {
  const store = createSampleTestStore();
  const initialFebBanks = store.periods['2026-02'].bancos;
  const initialJanCount = store.periods['2026-01'].lancamentos.length;
  assert.ok(initialJanCount > 0);
  assert.ok(store.periods['2026-02'].lancamentos.length > 0);

  // Active period only
  const clearedActive = clearStoreTransactions(store, 'active');
  assert.equal(clearedActive.periods['2026-02'].lancamentos.length, 0);
  assert.equal(clearedActive.periods['2026-01'].lancamentos.length, initialJanCount);
  assert.deepEqual(clearedActive.periods['2026-02'].bancos, initialFebBanks);
  assert.deepEqual(clearedActive.categorias, store.categorias);
  assert.deepEqual(clearedActive.titulares, store.titulares);
  assert.deepEqual(clearedActive.formasPagamento, store.formasPagamento);

  // All periods
  const clearedAll = clearStoreTransactions(store, 'all');
  assert.equal(clearedAll.periods['2026-01'].lancamentos.length, 0);
  assert.equal(clearedAll.periods['2026-02'].lancamentos.length, 0);
  assert.deepEqual(clearedAll.periods['2026-02'].bancos, initialFebBanks);
  assert.deepEqual(clearedAll.categorias, store.categorias);
});

test('resetStoreForFreshStart zeroes all transactions and bank values while preserving template structure', () => {
  const store = createSampleTestStore();
  const initialBankNames = store.periods['2026-02'].bancos.map((b) => b.nome);

  const fresh = resetStoreForFreshStart(store);
  assert.equal(Object.keys(fresh.periods).length, 1);
  assert.ok(fresh.periods['2026-02']);
  assert.equal(fresh.periods['2026-02'].lancamentos.length, 0);

  const zeroedBanks = fresh.periods['2026-02'].bancos;
  assert.deepEqual(
    zeroedBanks.map((b) => b.nome),
    initialBankNames,
  );
  for (const bank of zeroedBanks) {
    assert.equal(bank.saldoConta, 0);
    assert.equal(bank.descontoComprometido, 0);
    assert.equal(bank.caixinhaCofrinho, 0);
    assert.equal(bank.investimentos, 0);
    assert.equal(bank.criptomoedas, 0);
    assert.equal(bank.faturaCC, 0);
    assert.equal(bank.dividendosRecebidos, 0);
  }

  assert.deepEqual(fresh.categorias, store.categorias);
  assert.deepEqual(fresh.titulares, store.titulares);
  assert.deepEqual(fresh.formasPagamento, store.formasPagamento);
  assert.deepEqual(fresh.cartoes, store.cartoes);
  assert.equal(isValidThemeId('vibrant-gold-green-blue'), true);
});

test('splitAmountIntoInstallments divides totals cleanly in cents and supports per-installment mode', () => {
  const splitTotal = splitAmountIntoInstallments(100, 3, 'TOTAL');
  assert.deepEqual(splitTotal, [33.34, 33.33, 33.33]);
  const sum = splitTotal.reduce((a, b) => a + b, 0);
  assert.equal(Math.round(sum * 100), 10000);

  const splitParcela = splitAmountIntoInstallments(150.5, 4, 'PARCELA');
  assert.deepEqual(splitParcela, [150.5, 150.5, 150.5, 150.5]);
});

test('credit card installment planner aligns due day, handles February clamping and year rollover, and generates batch periods', () => {
  assert.equal(clampDayToMonth(2026, 2, 31), 28);
  assert.equal(clampDayToMonth(2024, 2, 31), 29);
  assert.equal(clampDayToMonth(2026, 4, 31), 30);

  // Purchase day after due day (20 > 10) defaults to next month
  const startNext = getDefaultFirstInstallmentStart(2026, 11, 20, 10);
  assert.deepEqual(startNext, { ano: 2026, mes: 12, isNextMonth: true });

  // Purchase day <= due day (05 <= 15) defaults to same month
  const startSame = getDefaultFirstInstallmentStart(2026, 11, 5, 15);
  assert.deepEqual(startSame, { ano: 2026, mes: 11, isNextMonth: false });

  const nubank = { id: 'cc_nubank', nome: 'Nubank', diaVencimento: 31 };

  // 1x preserves single transaction behavior
  const singlePlan = buildInstallmentPlan({
    data: '18/11/2026',
    tipo: 'DESPESA',
    categoria: 'ALIMENTAÇÃO',
    descricao: 'Restaurante',
    valor: 120,
    obs: 'Almoço',
    formaPagamento: 'CC',
    titular: 'ezequiel',
    card: nubank,
    parcelas: 1,
    valorModo: 'TOTAL',
  });
  assert.equal(singlePlan.items.length, 1);
  assert.equal(singlePlan.items[0].data, '18/11/2026');
  assert.equal(singlePlan.items[0].mes, 11);
  assert.equal(singlePlan.items[0].cartaoNome, 'Nubank');
  assert.equal(singlePlan.items[0].parcelaAtual, undefined);

  // 4x starting Dec/2026 across Jan, Feb (clamped to 28), Mar 2027
  const multiPlan = buildInstallmentPlan({
    data: '25/11/2026',
    tipo: 'DESPESA',
    categoria: 'CASA',
    descricao: 'Eletrodomésticos',
    valor: 1000,
    obs: 'Cafeteira',
    formaPagamento: 'CC',
    titular: 'familia',
    card: nubank,
    parcelas: 4,
    valorModo: 'TOTAL',
    primeiraParcelaOffset: 1,
  });
  assert.equal(multiPlan.items.length, 4);
  assert.equal(multiPlan.totalValor, 1000);
  assert.deepEqual(
    multiPlan.items.map((i) => ({
      data: i.data,
      mes: i.mes,
      ano: i.ano,
      valor: i.valor,
      parcela: `${i.parcelaAtual}/${i.totalParcelas}`,
    })),
    [
      { data: '31/12/2026', mes: 12, ano: 2026, valor: 250, parcela: '1/4' },
      { data: '31/01/2027', mes: 1, ano: 2027, valor: 250, parcela: '2/4' },
      { data: '28/02/2027', mes: 2, ano: 2027, valor: 250, parcela: '3/4' },
      { data: '31/03/2027', mes: 3, ano: 2027, valor: 250, parcela: '4/4' },
    ],
  );
  assert.ok(multiPlan.items[0].obs.includes('Nubank (1/4)'));
  assert.ok(multiPlan.items[3].obs.includes('Nubank (4/4)'));

  const baseStore = createInitialFinanceStore();
  const updatedStore = addTransactionsBatchToStore(baseStore, multiPlan.items);
  assert.equal(updatedStore.periods['2026-12'].lancamentos.length, 1);
  assert.equal(updatedStore.periods['2027-01'].lancamentos.length, 1);
  assert.equal(updatedStore.periods['2027-02'].lancamentos.length, 1);
  assert.equal(updatedStore.periods['2027-03'].lancamentos.length, 1);

  // Export & re-import includes cartoes without duplicating cards
  const exportPayload = buildPeriodExportPayload(
    updatedStore.periods['2026-12'],
    updatedStore.categorias,
    [...updatedStore.cartoes, { id: 'cc_inter', nome: 'Inter', diaVencimento: 20 }],
  );
  const imported = parseAndMergeImportedPayloads(updatedStore, [
    { name: 'financas_2026_12.json', content: JSON.stringify(exportPayload) },
  ]);
  assert.equal(imported.errors.length, 0);
  assert.ok(imported.nextStore.cartoes.some((c) => c.nome === 'Inter' && c.diaVencimento === 20));
  assert.equal(
    imported.nextStore.cartoes.filter((c) => c.nome.toLowerCase() === 'nubank').length,
    1,
  );
});

test('1x CC purchases after card due day route to next month automatically and allow manual override', () => {
  const card18 = { id: 'cc_18', nome: 'Santander', diaVencimento: 18 };

  // Purchase on 20/11/2026 (> 18) routes to 12/2026 automatically
  const autoNext = buildInstallmentPlan({
    data: '20/11/2026',
    tipo: 'DESPESA',
    categoria: 'ALIMENTAÇÃO',
    descricao: 'Restaurante',
    valor: 95,
    obs: 'Jantar',
    formaPagamento: 'CC',
    titular: 'ezequiel',
    card: card18,
    parcelas: 1,
    valorModo: 'TOTAL',
  });
  assert.equal(autoNext.items.length, 1);
  assert.equal(autoNext.items[0].mes, 12);
  assert.equal(autoNext.items[0].ano, 2026);
  assert.equal(autoNext.items[0].data, '18/12/2026');

  // Manual override to offset 0 keeps in 11/2026 with purchase date
  const forcedSame = buildInstallmentPlan({
    data: '20/11/2026',
    tipo: 'DESPESA',
    categoria: 'ALIMENTAÇÃO',
    descricao: 'Restaurante',
    valor: 95,
    obs: 'Jantar',
    formaPagamento: 'CC',
    titular: 'ezequiel',
    card: card18,
    parcelas: 1,
    valorModo: 'TOTAL',
    primeiraParcelaOffset: 0,
  });
  assert.equal(forcedSame.items[0].mes, 11);
  assert.equal(forcedSame.items[0].ano, 2026);
  assert.equal(forcedSame.items[0].data, '20/11/2026');
});

test('computeCumulativeAndFutureOverview computes accumulated balance and future scheduled expenses across periods', () => {
  const store = createInitialFinanceStore();
  store.periods['2026-10'] = {
    periodoKey: '2026-10',
    ano: 2026,
    mes: 10,
    lancamentos: [
      {
        id: 't_oct_1',
        data: '05/10/2026',
        mes: 10,
        ano: 2026,
        tipo: 'RECEITA',
        categoria: 'RECEITAS',
        descricao: 'Salário',
        valor: 3000,
        obs: '',
        formaPagamento: 'PIXR',
        titular: 'ezequiel',
      },
      {
        id: 't_oct_2',
        data: '10/10/2026',
        mes: 10,
        ano: 2026,
        tipo: 'DESPESA',
        categoria: 'CASA',
        descricao: 'Aluguel',
        valor: 1000,
        obs: '',
        formaPagamento: 'PIXD',
        titular: 'ezequiel',
      },
    ],
    bancos: [],
    metas: {},
  };
  store.periods['2026-11'] = {
    periodoKey: '2026-11',
    ano: 2026,
    mes: 11,
    lancamentos: [
      {
        id: 't_nov_1',
        data: '05/11/2026',
        mes: 11,
        ano: 2026,
        tipo: 'RECEITA',
        categoria: 'RECEITAS',
        descricao: 'Salário',
        valor: 1000,
        obs: '',
        formaPagamento: 'PIXR',
        titular: 'ezequiel',
      },
      {
        id: 't_nov_2',
        data: '12/11/2026',
        mes: 11,
        ano: 2026,
        tipo: 'DESPESA',
        categoria: 'LAZER',
        descricao: 'Viagens',
        valor: 500,
        obs: '',
        formaPagamento: 'PIXD',
        titular: 'familia',
      },
    ],
    bancos: [],
    metas: {},
  };
  store.periods['2026-12'] = {
    periodoKey: '2026-12',
    ano: 2026,
    mes: 12,
    lancamentos: [
      {
        id: 't_dec_1',
        data: '18/12/2026',
        mes: 12,
        ano: 2026,
        tipo: 'DESPESA',
        categoria: 'CASA',
        descricao: 'Eletrodomésticos',
        valor: 200,
        obs: 'Santander (1/2)',
        formaPagamento: 'CC',
        titular: 'ezequiel',
        parcelaAtual: 1,
        totalParcelas: 2,
      },
    ],
    bancos: [],
    metas: {},
  };
  store.periods['2027-01'] = {
    periodoKey: '2027-01',
    ano: 2027,
    mes: 1,
    lancamentos: [
      {
        id: 't_jan_1',
        data: '18/01/2027',
        mes: 1,
        ano: 2027,
        tipo: 'DESPESA',
        categoria: 'CASA',
        descricao: 'Eletrodomésticos',
        valor: 200,
        obs: 'Santander (2/2)',
        formaPagamento: 'CC',
        titular: 'ezequiel',
        parcelaAtual: 2,
        totalParcelas: 2,
      },
    ],
    bancos: [],
    metas: {},
  };

  const novAll = computeCumulativeAndFutureOverview(store.periods, 2026, 11, 'Todos');
  assert.equal(novAll.saldoAcumuladoAnterior, 2000);
  assert.equal(novAll.saldoMesAtual, 500);
  assert.equal(novAll.saldoAcumuladoAtePeriodo, 2500);
  assert.equal(novAll.despesasFuturasTotal, 400);
  assert.equal(novAll.despesasFuturasCount, 2);
  assert.equal(novAll.parcelasFuturasCount, 2);
  assert.equal(novAll.mesesFuturosCount, 2);
  assert.equal(novAll.proximoMesComDespesa?.periodoKey, '2026-12');
  assert.equal(novAll.proximoMesComDespesa?.valor, 200);
  assert.equal(novAll.timeline.length, 4);
  assert.equal(novAll.timeline[3].saldoAcumulado, 2100);

  // Filter by titular ezequiel excludes familia R$ 500 expense in Nov
  const novEzequiel = computeCumulativeAndFutureOverview(
    store.periods,
    2026,
    11,
    'ezequiel',
  );
  assert.equal(novEzequiel.saldoMesAtual, 1000);
  assert.equal(novEzequiel.saldoAcumuladoAtePeriodo, 3000);
});




