import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPeriodExportPayload,
  clearStoreTransactions,
  computeAnnualPivot,
  computeBankHistory,
  computeBankMetrics,
  computeConsolidatedBanks,
  computeDashboardSummary,
  filterTransactions,
  parseAndMergeImportedPayloads,
  resetStoreForFreshStart,
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
  assert.equal(isValidThemeId('vibrant-gold-green-blue'), true);
});


