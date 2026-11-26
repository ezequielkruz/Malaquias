import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import type {
  BankAccount,
  CreditCardConfig,
  FinanceStore,
  TabId,
  Transaction,
  TransactionType,
} from './types/finance';
import {
  addTransactionsBatchToStore,
  buildPeriodExportPayload,
  clearStoreTransactions,
  deleteTransactionFromStore,
  getOrCreatePeriodSnapshot,
  parseAndMergeImportedPayloads,
  resetStoreForFreshStart,
  saveTransactionInStore,
} from './utils/calculations';
import {
  formatExportFilename,
  formatPeriodLabel,
  generateId,
  getPeriodKey,
} from './utils/format';
import { loadFinanceStore, saveFinanceStore } from './utils/storage';
import {
  applyThemeToDocument,
  loadTheme,
  saveTheme,
  type ThemeId,
} from './utils/theme';
import { HeaderNav } from './components/HeaderNav';
import { DashboardTab } from './components/DashboardTab';
import { ControleTab } from './components/ControleTab';
import { BancosTab } from './components/BancosTab';
import { OrcamentoAnualTab } from './components/OrcamentoAnualTab';
import { CategoriasTab } from './components/CategoriasTab';
import { TransactionModal } from './components/TransactionModal';
import { ResetDataModal } from './components/ResetDataModal';

interface NoticeBanner {
  kind: 'success' | 'error';
  message: string;
}

export default function App() {
  const [store, setStore] = useState<FinanceStore>(() => loadFinanceStore());
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const [activeTab, setActiveTab] = useState<TabId>('resumo');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeBanner | null>(null);

  useEffect(() => {
    saveFinanceStore(store);
  }, [store]);

  useEffect(() => {
    applyThemeToDocument(theme);
    saveTheme(theme);
  }, [theme]);

  const activePeriod = useMemo(
    () => getOrCreatePeriodSnapshot(store, store.activeAno, store.activeMes),
    [store],
  );

  const totalTransactionsCount = useMemo(
    () =>
      Object.values(store.periods).reduce(
        (sum, snap) => sum + snap.lancamentos.length,
        0,
      ),
    [store.periods],
  );

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yrs = new Set<number>([
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      store.activeAno,
    ]);
    for (const snap of Object.values(store.periods)) {
      yrs.add(snap.ano);
    }
    return Array.from(yrs).sort((a, b) => a - b);
  }, [store.periods, store.activeAno]);

  const handleChangePeriod = (ano: number, mes: number) => {
    setStore((prev) => ({
      ...prev,
      activeAno: ano,
      activeMes: mes,
    }));
  };

  // Transaction CRUD (works across active or searched periods)
  const handleSaveTransaction = (
    txData: Omit<Transaction, 'id'>,
    existingId?: string,
  ) => {
    const targetKey = getPeriodKey(txData.ano, txData.mes);
    const activeKey = getPeriodKey(store.activeAno, store.activeMes);

    setStore((prev) => saveTransactionInStore(prev, txData, existingId).nextStore);

    if (existingId) {
      setNotice({
        kind: 'success',
        message: `Lançamento atualizado com sucesso em ${formatPeriodLabel(txData.ano, txData.mes)}.`,
      });
    } else if (targetKey !== activeKey) {
      setNotice({
        kind: 'success',
        message: `Lançamento registrado automaticamente em ${formatPeriodLabel(txData.ano, txData.mes)} pela data informada.`,
      });
    } else {
      setNotice({
        kind: 'success',
        message: 'Lançamento salvo no Controle.',
      });
    }
  };

  const handleSaveTransactionsBatch = (items: Array<Omit<Transaction, 'id'>>) => {
    if (items.length === 0) return;
    setStore((prev) => addTransactionsBatchToStore(prev, items));
    const first = items[0];
    const last = items[items.length - 1];
    const cardSuffix = first.cartaoNome ? ` no cartão ${first.cartaoNome}` : '';
    setNotice({
      kind: 'success',
      message: `${items.length} parcelas geradas${cardSuffix} (${formatPeriodLabel(first.ano, first.mes)} até ${formatPeriodLabel(last.ano, last.mes)}).`,
    });
  };

  const handleDeleteTransaction = (id: string) => {
    setStore((prev) => deleteTransactionFromStore(prev, id));
  };

  // Bank CRUD
  const handleAddBank = (nome: string) => {
    const key = getPeriodKey(store.activeAno, store.activeMes);
    setStore((prev) => {
      const snap = getOrCreatePeriodSnapshot(prev, prev.activeAno, prev.activeMes);
      const newBank: BankAccount = {
        id: generateId('bank'),
        nome,
        saldoConta: 0,
        descontoComprometido: 0,
        caixinhaCofrinho: 0,
        investimentos: 0,
        criptomoedas: 0,
        faturaCC: 0,
        dividendosRecebidos: 0,
      };
      return {
        ...prev,
        periods: {
          ...prev.periods,
          [key]: {
            ...snap,
            bancos: [...snap.bancos, newBank],
          },
        },
      };
    });
  };

  const handleUpdateBank = (id: string, patch: Partial<BankAccount>) => {
    const key = getPeriodKey(store.activeAno, store.activeMes);
    setStore((prev) => {
      const snap = getOrCreatePeriodSnapshot(prev, prev.activeAno, prev.activeMes);
      return {
        ...prev,
        periods: {
          ...prev.periods,
          [key]: {
            ...snap,
            bancos: snap.bancos.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          },
        },
      };
    });
  };

  const handleDeleteBank = (id: string) => {
    const key = getPeriodKey(store.activeAno, store.activeMes);
    setStore((prev) => {
      const snap = getOrCreatePeriodSnapshot(prev, prev.activeAno, prev.activeMes);
      return {
        ...prev,
        periods: {
          ...prev.periods,
          [key]: {
            ...snap,
            bancos: snap.bancos.filter((b) => b.id !== id),
          },
        },
      };
    });
  };

  // Categories, Titulares & Payment Methods CRUD
  const handleAddCategory = (nome: string, tipo: TransactionType) => {
    setStore((prev) => {
      if (
        prev.categorias.some(
          (c) => c.nome.toUpperCase() === nome.toUpperCase() && c.tipo === tipo,
        )
      ) {
        return prev;
      }
      return {
        ...prev,
        categorias: [
          ...prev.categorias,
          {
            id: generateId('cat'),
            nome,
            tipo,
            subcategorias: ['Outros'],
          },
        ],
      };
    });
  };

  const handleDeleteCategory = (id: string) => {
    setStore((prev) => ({
      ...prev,
      categorias: prev.categorias.filter((c) => c.id !== id),
    }));
  };

  const handleAddSubcategory = (categoryId: string, subName: string) => {
    setStore((prev) => ({
      ...prev,
      categorias: prev.categorias.map((c) =>
        c.id === categoryId && !c.subcategorias.includes(subName)
          ? { ...c, subcategorias: [...c.subcategorias, subName] }
          : c,
      ),
    }));
  };

  const handleDeleteSubcategory = (categoryId: string, subName: string) => {
    setStore((prev) => ({
      ...prev,
      categorias: prev.categorias.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              subcategorias: c.subcategorias.filter((s) => s !== subName),
            }
          : c,
      ),
    }));
  };

  const handleAddTitular = (name: string) => {
    setStore((prev) =>
      prev.titulares.includes(name)
        ? prev
        : { ...prev, titulares: [...prev.titulares, name] },
    );
  };

  const handleDeleteTitular = (name: string) => {
    setStore((prev) => ({
      ...prev,
      titulares: prev.titulares.filter((t) => t !== name),
    }));
  };

  const handleAddFormaPagamento = (name: string) => {
    setStore((prev) =>
      prev.formasPagamento.includes(name)
        ? prev
        : { ...prev, formasPagamento: [...prev.formasPagamento, name] },
    );
  };

  const handleDeleteFormaPagamento = (name: string) => {
    setStore((prev) => ({
      ...prev,
      formasPagamento: prev.formasPagamento.filter((f) => f !== name),
    }));
  };

  // Credit Cards CRUD
  const handleAddCreditCard = (
    nome: string,
    diaVencimento: number,
  ): CreditCardConfig | null => {
    const cleanName = nome.trim();
    const due = Math.min(Math.max(Math.round(diaVencimento), 1), 31);
    if (!cleanName) return null;

    const currentCards = store.cartoes || [];
    if (
      currentCards.some(
        (c) => c.nome.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      return null;
    }

    const newCard: CreditCardConfig = {
      id: generateId('cc'),
      nome: cleanName,
      diaVencimento: due,
    };

    setStore((prev) => ({
      ...prev,
      cartoes: [...(prev.cartoes || []), newCard],
    }));
    return newCard;
  };

  const handleUpdateCreditCard = (
    id: string,
    nome: string,
    diaVencimento: number,
  ) => {
    const cleanName = nome.trim();
    const due = Math.min(Math.max(Math.round(diaVencimento), 1), 31);
    if (!cleanName) return;

    setStore((prev) => ({
      ...prev,
      cartoes: (prev.cartoes || []).map((c) =>
        c.id === id ? { ...c, nome: cleanName, diaVencimento: due } : c,
      ),
    }));
  };

  const handleDeleteCreditCard = (id: string) => {
    setStore((prev) => ({
      ...prev,
      cartoes: (prev.cartoes || []).filter((c) => c.id !== id),
    }));
  };

  // JSON Export & Multi-File Import
  const handleExportPeriodJson = () => {
    const payload = buildPeriodExportPayload(
      activePeriod,
      store.categorias,
      store.cartoes || [],
    );
    const filename = formatExportFilename(store.activeAno, store.activeMes);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotice({
      kind: 'success',
      message: `Arquivo "${filename}" exportado com ${activePeriod.lancamentos.length} lançamento(s) e ${activePeriod.bancos.length} instituição(ões).`,
    });
  };

  const handleClearTransactions = (scope: 'active' | 'all') => {
    setStore((prev) => clearStoreTransactions(prev, scope));
    setNotice({
      kind: 'success',
      message:
        scope === 'active'
          ? `Lançamentos de ${formatPeriodLabel(store.activeAno, store.activeMes)} limpos. Categorias e saldos bancários mantidos.`
          : 'Todos os lançamentos de todos os períodos foram limpos. Categorias e saldos bancários mantidos.',
    });
  };

  const handleResetFreshStart = () => {
    setStore((prev) => resetStoreForFreshStart(prev));
    setNotice({
      kind: 'success',
      message:
        'Modo Amigo ativado: lançamentos apagados e saldos bancários zerados em R$ 0,00. Categorias, Titulares, Formas de Pagamento e Cartões mantidos.',
    });
  };

  const handleImportJsonFiles = async (files: FileList) => {
    const rawFiles: Array<{ name: string; content: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const content = await f.text();
      rawFiles.push({ name: f.name, content });
    }

    const result = parseAndMergeImportedPayloads(store, rawFiles);
    setStore(result.nextStore);

    if (result.errors.length > 0 && result.importedPeriods.length === 0) {
      setNotice({
        kind: 'error',
        message: result.errors.join(' '),
      });
    } else if (result.errors.length > 0) {
      setNotice({
        kind: 'success',
        message: `${result.importedPeriods.length} período(s) consolidado(s) (${result.importedTransactionsCount} lançamentos). Avisos: ${result.errors.join(' ')}`,
      });
    } else {
      setNotice({
        kind: 'success',
        message:
          result.importedPeriods.length === 1
            ? `Período ${result.importedPeriods[0]} importado com ${result.importedTransactionsCount} lançamento(s).`
            : `${result.importedPeriods.length} períodos consolidados (${result.importedTransactionsCount} lançamentos) no Orçamento Anual.`,
      });
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      <HeaderNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewTransaction={() => {
          setAutoStartVoice(false);
          setIsTxModalOpen(true);
        }}
        onOpenVoiceTransaction={() => {
          setAutoStartVoice(true);
          setIsTxModalOpen(true);
        }}
        activeAno={store.activeAno}
        activeMes={store.activeMes}
        availableYears={availableYears}
        onChangePeriod={handleChangePeriod}
        onExportPeriodJson={handleExportPeriodJson}
        onImportJsonFiles={handleImportJsonFiles}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        theme={theme}
        onChangeTheme={setTheme}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {notice && (
          <div
            role="status"
            className={`mb-5 px-4 py-3 rounded-xl border flex items-center justify-between gap-4 text-sm ${
              notice.kind === 'success'
                ? 'border-[var(--semantic-income)]/40 bg-[var(--semantic-income-bg)] text-[var(--text-primary)]'
                : 'border-[var(--semantic-expense)]/40 bg-[var(--semantic-expense-bg)] text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {notice.kind === 'success' ? (
                <CheckCircle2
                  className="w-4 h-4 text-[var(--semantic-income)] shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="w-4 h-4 text-[var(--semantic-expense)] shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="break-words">{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Fechar aviso"
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {activeTab === 'resumo' && (
          <DashboardTab
            ano={store.activeAno}
            mes={store.activeMes}
            transactions={activePeriod.lancamentos}
            banks={activePeriod.bancos}
            periods={store.periods}
            titulares={store.titulares}
            theme={theme}
            onOpenNewTransaction={() => setIsTxModalOpen(true)}
            onNavigateToBancos={() => setActiveTab('bancos')}
          />
        )}

        {activeTab === 'controle' && (
          <ControleTab
            ano={store.activeAno}
            mes={store.activeMes}
            transactions={activePeriod.lancamentos}
            periods={store.periods}
            categories={store.categorias}
            titulares={store.titulares}
            formasPagamento={store.formasPagamento}
            onAddTransaction={(tx) => handleSaveTransaction(tx)}
            onUpdateTransaction={(id, tx) => handleSaveTransaction(tx, id)}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenModal={() => setIsTxModalOpen(true)}
          />
        )}

        {activeTab === 'bancos' && (
          <BancosTab
            ano={store.activeAno}
            mes={store.activeMes}
            banks={activePeriod.bancos}
            periods={store.periods}
            titulares={store.titulares}
            onAddBank={handleAddBank}
            onUpdateBank={handleUpdateBank}
            onDeleteBank={handleDeleteBank}
            onSyncToControle={(tx) => handleSaveTransaction(tx)}
          />
        )}

        {activeTab === 'anual' && (
          <OrcamentoAnualTab
            ano={store.activeAno}
            periods={store.periods}
            categories={store.categorias}
          />
        )}

        {activeTab === 'categorias' && (
          <CategoriasTab
            categories={store.categorias}
            titulares={store.titulares}
            formasPagamento={store.formasPagamento}
            cartoes={store.cartoes || []}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddSubcategory={handleAddSubcategory}
            onDeleteSubcategory={handleDeleteSubcategory}
            onAddTitular={handleAddTitular}
            onDeleteTitular={handleDeleteTitular}
            onAddFormaPagamento={handleAddFormaPagamento}
            onDeleteFormaPagamento={handleDeleteFormaPagamento}
            onAddCreditCard={handleAddCreditCard}
            onUpdateCreditCard={handleUpdateCreditCard}
            onDeleteCreditCard={handleDeleteCreditCard}
            onOpenResetModal={() => setIsResetModalOpen(true)}
          />
        )}
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span>Gestor Financeiro 3.10 · Controle Pessoal e Familiar</span>
          <span>Persistência automática local · Portabilidade JSON por período</span>
        </div>
      </footer>

      <TransactionModal
        isOpen={isTxModalOpen}
        autoStartVoice={autoStartVoice}
        activeAno={store.activeAno}
        activeMes={store.activeMes}
        categories={store.categorias}
        titulares={store.titulares}
        formasPagamento={store.formasPagamento}
        cartoes={store.cartoes || []}
        onAddCreditCard={handleAddCreditCard}
        onClose={() => {
          setIsTxModalOpen(false);
          setAutoStartVoice(false);
        }}
        onSave={handleSaveTransaction}
        onSaveBatch={handleSaveTransactionsBatch}
      />

      <ResetDataModal
        isOpen={isResetModalOpen}
        activeAno={store.activeAno}
        activeMes={store.activeMes}
        activeTransactionsCount={activePeriod.lancamentos.length}
        totalTransactionsCount={totalTransactionsCount}
        banksCount={activePeriod.bancos.length}
        onClose={() => setIsResetModalOpen(false)}
        onExportBackup={handleExportPeriodJson}
        onClearTransactions={handleClearTransactions}
        onResetFreshStart={handleResetFreshStart}
      />
    </div>
  );
}
