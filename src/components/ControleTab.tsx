import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { CategoryConfig, Transaction, TransactionType } from '../types/finance';
import { filterTransactions } from '../utils/calculations';
import {
  formatBRL,
  formatPeriodLabel,
  getDefaultDateForPeriod,
  maskBRDateInput,
  parseBRDate,
} from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface ControleTabProps {
  ano: number;
  mes: number;
  transactions: Transaction[];
  categories: CategoryConfig[];
  titulares: string[];
  formasPagamento: string[];
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (id: string, tx: Omit<Transaction, 'id'>) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenModal: () => void;
}

export const ControleTab: React.FC<ControleTabProps> = ({
  ano,
  mes,
  transactions,
  categories,
  titulares,
  formasPagamento,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onOpenModal,
}) => {
  // Filters
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'TODOS' | TransactionType>('TODOS');
  const [filterCategoria, setFilterCategoria] = useState('TODAS');
  const [filterForma, setFilterForma] = useState('TODAS');
  const [filterTitular, setFilterTitular] = useState('Todos');

  // Quick-add state (shared between desktop inline row and mobile quick-add card)
  const defaultDespesaCat =
    categories.find((c) => c.tipo === 'DESPESA') || categories[0];

  const [newData, setNewData] = useState(() =>
    getDefaultDateForPeriod(ano, mes, new Date().getDate()),
  );
  const [newTipo, setNewTipo] = useState<TransactionType>('DESPESA');
  const [newCat, setNewCat] = useState(defaultDespesaCat?.nome || 'ALIMENTAÇÃO');
  const [newDesc, setNewDesc] = useState(
    defaultDespesaCat?.subcategorias[0] || 'Supermercado',
  );
  const [newValor, setNewValor] = useState(0);
  const [newObs, setNewObs] = useState('');
  const [newForma, setNewForma] = useState(formasPagamento[0] || 'PIXD');
  const [newTitular, setNewTitular] = useState(titulares[0] || 'ezequiel');
  const [quickError, setQuickError] = useState('');
  const [showMobileQuickAdd, setShowMobileQuickAdd] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Omit<Transaction, 'id'> | null>(null);

  React.useEffect(() => {
    setNewData(getDefaultDateForPeriod(ano, mes, 15));
  }, [ano, mes]);

  const getCatsForType = (tipo: TransactionType) =>
    categories.filter((c) => c.tipo === tipo);

  const getSubsForCat = (tipo: TransactionType, catName: string) => {
    const found = categories.find(
      (c) => c.tipo === tipo && c.nome === catName,
    );
    return found?.subcategorias || ['Outros'];
  };

  const quickCats = getCatsForType(newTipo);
  const quickSubs = getSubsForCat(newTipo, newCat);

  const handleQuickTipoChange = (tipo: TransactionType) => {
    setNewTipo(tipo);
    const matching = getCatsForType(tipo);
    if (matching.length > 0) {
      setNewCat(matching[0].nome);
      setNewDesc(matching[0].subcategorias[0] || 'Outros');
    }
  };

  const handleQuickCatChange = (catName: string) => {
    setNewCat(catName);
    const subs = getSubsForCat(newTipo, catName);
    setNewDesc(subs[0] || 'Outros');
  };

  const handleQuickSave = () => {
    setQuickError('');
    const parsed = parseBRDate(newData);
    if (!parsed.isValid) {
      setQuickError('Data inválida. Use DD/MM/AAAA.');
      return;
    }
    if (newValor <= 0) {
      setQuickError('Informe um valor maior que R$ 0,00.');
      return;
    }

    onAddTransaction({
      data: newData,
      mes: parsed.mes,
      ano: parsed.ano,
      tipo: newTipo,
      categoria: newCat,
      descricao: newDesc,
      valor: newValor,
      obs: newObs.trim(),
      formaPagamento: newForma,
      titular: newTitular,
    });

    setNewValor(0);
    setNewObs('');
    setShowMobileQuickAdd(false);
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickSave();
    }
  };

  const startEditing = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditDraft({
      data: tx.data,
      mes: tx.mes,
      ano: tx.ano,
      tipo: tx.tipo,
      categoria: tx.categoria,
      descricao: tx.descricao,
      valor: tx.valor,
      obs: tx.obs,
      formaPagamento: tx.formaPagamento,
      titular: tx.titular,
    });
  };

  const saveEditing = () => {
    if (!editingId || !editDraft) return;
    const parsed = parseBRDate(editDraft.data);
    if (!parsed.isValid || editDraft.valor <= 0) return;

    onUpdateTransaction(editingId, {
      ...editDraft,
      mes: parsed.mes,
      ano: parsed.ano,
    });
    setEditingId(null);
    setEditDraft(null);
  };

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        search,
        tipo: filterTipo,
        categoria: filterCategoria,
        formaPagamento: filterForma,
        titular: filterTitular,
      }),
    [transactions, search, filterTipo, filterCategoria, filterForma, filterTitular],
  );

  const totals = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    for (const tx of filteredTransactions) {
      if (tx.tipo === 'RECEITA') receitas += tx.valor;
      else despesas += tx.valor;
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [filteredTransactions]);

  const uniqueCategoryNames = useMemo(
    () => Array.from(new Set(categories.map((c) => c.nome))),
    [categories],
  );

  return (
    <section aria-label="Controle de Lançamentos Diários" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Controle — {formatPeriodLabel(ano, mes)}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Planilha de lançamentos diários · Pressione Enter para salvar rapidamente na linha
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowMobileQuickAdd((v) => !v)}
            className="md:hidden w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] text-[var(--text-primary)] text-sm font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[var(--accent-gold)]" aria-hidden="true" />
            <span>{showMobileQuickAdd ? 'Fechar Lançamento Rápido' : 'Lançamento Rápido'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] hover:opacity-90 text-[var(--text-primary)] text-sm font-semibold transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[var(--accent-gold)]" aria-hidden="true" />
            <span>Lançamento em Janela</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar (Full width comfortable controls on mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-4">
        <div className="sm:col-span-2 relative">
          <label htmlFor="controle-search" className="sr-only">
            Buscar por descrição ou observação
          </label>
          <Search
            className="w-4 h-4 text-[var(--accent-blue)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="controle-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição, loja ou obs..."
            className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
          />
        </div>

        <div>
          <label htmlFor="filter-tipo" className="sr-only">
            Filtrar por tipo
          </label>
          <select
            id="filter-tipo"
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as 'TODOS' | TransactionType)}
            className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
          >
            <option value="TODOS">Tipo: Todos</option>
            <option value="RECEITA">Tipo: RECEITA</option>
            <option value="DESPESA">Tipo: DESPESA</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-categoria" className="sr-only">
            Filtrar por categoria
          </label>
          <select
            id="filter-categoria"
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
          >
            <option value="TODAS">Categoria: Todas</option>
            {uniqueCategoryNames.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-forma" className="sr-only">
            Filtrar por forma de pagamento
          </label>
          <select
            id="filter-forma"
            value={filterForma}
            onChange={(e) => setFilterForma(e.target.value)}
            className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
          >
            <option value="TODAS">Pago / Forma: Todas</option>
            {formasPagamento.map((fp) => (
              <option key={fp} value={fp}>
                {fp}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-titular" className="sr-only">
            Filtrar por titular
          </label>
          <select
            id="filter-titular"
            value={filterTitular}
            onChange={(e) => setFilterTitular(e.target.value)}
            className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
          >
            <option value="Todos">Titular: Todos</option>
            {titulares.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {quickError && (
        <div
          role="alert"
          className="px-4 py-2.5 rounded-lg border border-[var(--semantic-expense)]/40 bg-[var(--semantic-expense-bg)] text-[var(--semantic-expense)] text-sm"
        >
          {quickError}
        </div>
      )}

      {/* MOBILE QUICK-ADD CARD (< 768px) */}
      {showMobileQuickAdd && (
        <div className="md:hidden rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-4 space-y-3">
          <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Novo Lançamento Rápido
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="m-new-data" className="block text-xs text-[var(--text-muted)] mb-1">
                Data
              </label>
              <input
                id="m-new-data"
                type="text"
                value={newData}
                onChange={(e) => setNewData(maskBRDateInput(e.target.value))}
                className="w-full font-mono-nums bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="m-new-tipo" className="block text-xs text-[var(--text-muted)] mb-1">
                Tipo
              </label>
              <select
                id="m-new-tipo"
                value={newTipo}
                onChange={(e) =>
                  handleQuickTipoChange(e.target.value as TransactionType)
                }
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm font-semibold text-[var(--text-primary)]"
              >
                <option value="DESPESA">DESPESA</option>
                <option value="RECEITA">RECEITA</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="m-new-cat" className="block text-xs text-[var(--text-muted)] mb-1">
                Categoria
              </label>
              <select
                id="m-new-cat"
                value={newCat}
                onChange={(e) => handleQuickCatChange(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
              >
                {quickCats.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m-new-desc" className="block text-xs text-[var(--text-muted)] mb-1">
                Descrição
              </label>
              <select
                id="m-new-desc"
                value={quickSubs.includes(newDesc) ? newDesc : quickSubs[0]}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
              >
                {quickSubs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-1">
              <label htmlFor="m-new-valor" className="block text-xs text-[var(--text-muted)] mb-1">
                Valor
              </label>
              <CurrencyInput
                id="m-new-valor"
                value={newValor}
                onChange={setNewValor}
                onEnter={handleQuickSave}
                className="w-full py-2"
              />
            </div>
            <div>
              <label htmlFor="m-new-forma" className="block text-xs text-[var(--text-muted)] mb-1">
                Pago
              </label>
              <select
                id="m-new-forma"
                value={newForma}
                onChange={(e) => setNewForma(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2 py-2 text-sm text-[var(--text-primary)]"
              >
                {formasPagamento.map((fp) => (
                  <option key={fp} value={fp}>
                    {fp}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m-new-titular" className="block text-xs text-[var(--text-muted)] mb-1">
                Titular
              </label>
              <select
                id="m-new-titular"
                value={newTitular}
                onChange={(e) => setNewTitular(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2 py-2 text-sm text-[var(--text-primary)]"
              >
                {titulares.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="m-new-obs" className="block text-xs text-[var(--text-muted)] mb-1">
              Observação
            </label>
            <input
              id="m-new-obs"
              type="text"
              value={newObs}
              onChange={(e) => setNewObs(e.target.value)}
              placeholder="Detalhe ou loja..."
              className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
            />
          </div>

          <button
            type="button"
            onClick={handleQuickSave}
            className="w-full py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-sm font-semibold cursor-pointer"
          >
            Salvar Lançamento
          </button>
        </div>
      )}

      {/* MOBILE CARD LIST (< 768px) */}
      <div className="md:hidden space-y-3" data-testid="controle-mobile-cards">
        {filteredTransactions.length === 0 ? (
          <div className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-8 text-center text-sm text-[var(--text-muted)]">
            Nenhum lançamento encontrado para os filtros atuais.
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isEditing = editingId === tx.id && editDraft !== null;
            if (isEditing && editDraft) {
              const editCats = getCatsForType(editDraft.tipo);
              const editSubs = getSubsForCat(editDraft.tipo, editDraft.categoria);
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border-[1.5px] border-[var(--accent-underline)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-4 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      aria-label="Editar data"
                      value={editDraft.data}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          data: maskBRDateInput(e.target.value),
                        })
                      }
                      className="font-mono-nums bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <select
                      aria-label="Editar tipo"
                      value={editDraft.tipo}
                      onChange={(e) => {
                        const nextTipo = e.target.value as TransactionType;
                        const matching = getCatsForType(nextTipo);
                        const firstCat = matching[0];
                        setEditDraft({
                          ...editDraft,
                          tipo: nextTipo,
                          categoria: firstCat?.nome || editDraft.categoria,
                          descricao: firstCat?.subcategorias[0] || 'Outros',
                        });
                      }}
                      className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
                    >
                      <option value="DESPESA">DESPESA</option>
                      <option value="RECEITA">RECEITA</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <select
                      aria-label="Editar categoria"
                      value={editDraft.categoria}
                      onChange={(e) => {
                        const nextCat = e.target.value;
                        const subs = getSubsForCat(editDraft.tipo, nextCat);
                        setEditDraft({
                          ...editDraft,
                          categoria: nextCat,
                          descricao: subs[0] || 'Outros',
                        });
                      }}
                      className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
                    >
                      {editCats.map((c) => (
                        <option key={c.id} value={c.nome}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Editar descrição"
                      value={
                        editSubs.includes(editDraft.descricao)
                          ? editDraft.descricao
                          : editSubs[0]
                      }
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, descricao: e.target.value })
                      }
                      className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
                    >
                      {editSubs.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CurrencyInput
                      ariaLabel="Editar valor"
                      value={editDraft.valor}
                      onChange={(v) => setEditDraft({ ...editDraft, valor: v })}
                      onEnter={saveEditing}
                      className="w-full py-2"
                    />
                    <select
                      aria-label="Editar forma de pagamento"
                      value={editDraft.formaPagamento}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, formaPagamento: e.target.value })
                      }
                      className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2 py-2 text-sm text-[var(--text-primary)]"
                    >
                      {formasPagamento.map((fp) => (
                        <option key={fp} value={fp}>
                          {fp}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Editar titular"
                      value={editDraft.titular}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, titular: e.target.value })
                      }
                      className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2 py-2 text-sm text-[var(--text-primary)]"
                    >
                      {titulares.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    aria-label="Editar observação"
                    value={editDraft.obs}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, obs: e.target.value })
                    }
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2.5 py-2 text-sm text-[var(--text-primary)]"
                  />

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                      className="py-2 rounded-lg border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveEditing}
                      className="py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] text-sm font-semibold cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <article
                key={tx.id}
                className={`rounded-xl border-[1.5px] [box-shadow:var(--card-shadow)] p-4 space-y-2.5 ${
                  tx.tipo === 'RECEITA'
                    ? 'border-[var(--card-income-border)] bg-[var(--card-income-bg)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono-nums">
                      <span>{tx.data}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          tx.tipo === 'RECEITA'
                            ? 'text-[var(--semantic-income)]'
                            : 'text-[var(--semantic-expense)]'
                        }`}
                      >
                        {tx.tipo === 'RECEITA' ? '+ RECEITA' : '- DESPESA'}
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-sm font-semibold text-[var(--text-primary)]">
                      {tx.categoria} · {tx.descricao}
                    </h3>
                  </div>

                  <span
                    className={`font-mono-nums text-base font-bold shrink-0 ${
                      tx.tipo === 'RECEITA'
                        ? 'text-[var(--semantic-income)]'
                        : 'text-[var(--semantic-expense)]'
                    }`}
                  >
                    {formatBRL(tx.valor)}
                  </span>
                </div>

                {tx.obs && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {tx.obs}
                  </p>
                )}

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="text-xs text-[var(--text-muted)] font-mono-nums">
                    <span>{tx.formaPagamento}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span className="font-sans">{tx.titular}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(tx)}
                      aria-label={`Editar ${tx.descricao} de ${tx.data}`}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(tx.id)}
                      aria-label={`Excluir ${tx.descricao} de ${tx.data}`}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--semantic-expense)] hover:bg-[var(--semantic-expense-bg)] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}

        {/* Mobile Totals Summary Bar */}
        <div className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] [box-shadow:var(--card-shadow)] p-4 space-y-2 text-xs font-mono-nums">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span>Lançamentos filtrados</span>
            <strong className="text-[var(--text-primary)]">{filteredTransactions.length}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Receitas</span>
            <strong className="text-[var(--semantic-income)]">{formatBRL(totals.receitas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Despesas</span>
            <strong className="text-[var(--semantic-expense)]">{formatBRL(totals.despesas)}</strong>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)] font-semibold">Saldo</span>
            <strong
              className={
                totals.saldo >= 0
                  ? 'text-[var(--semantic-income)]'
                  : 'text-[var(--semantic-expense)]'
              }
            >
              {formatBRL(totals.saldo, true)}
            </strong>
          </div>
        </div>
      </div>

      {/* DESKTOP SPREADSHEET TABLE (>= 768px) */}
      <div className="hidden md:block rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1060px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-header)] text-xs font-semibold text-[var(--text-secondary)]">
                <th className="py-3 px-3 w-32">Data</th>
                <th className="py-3 px-3 w-28">Tipo</th>
                <th className="py-3 px-3 w-40">Categoria</th>
                <th className="py-3 px-3 w-44">Descrição</th>
                <th className="py-3 px-3 w-36 text-right">Valor (R$)</th>
                <th className="py-3 px-3">Obs</th>
                <th className="py-3 px-3 w-32">Pago / Forma</th>
                <th className="py-3 px-3 w-28">Titular</th>
                <th className="py-3 px-3 w-24 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
              {/* Quick-Entry Spreadsheet Row */}
              <tr className="bg-[var(--bg-surface-alt)]">
                <td className="p-2">
                  <input
                    type="text"
                    aria-label="Nova data do lançamento"
                    value={newData}
                    onChange={(e) => setNewData(maskBRDateInput(e.target.value))}
                    onKeyDown={handleQuickKeyDown}
                    placeholder="DD/MM/AAAA"
                    className="w-full font-mono-nums bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
                  />
                </td>
                <td className="p-2">
                  <select
                    aria-label="Novo tipo do lançamento"
                    value={newTipo}
                    onChange={(e) =>
                      handleQuickTipoChange(e.target.value as TransactionType)
                    }
                    className={`w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-[var(--accent-underline)] ${
                      newTipo === 'RECEITA'
                        ? 'text-[var(--semantic-income)]'
                        : 'text-[var(--semantic-expense)]'
                    }`}
                  >
                    <option value="DESPESA">DESPESA</option>
                    <option value="RECEITA">RECEITA</option>
                  </select>
                </td>
                <td className="p-2">
                  <select
                    aria-label="Nova categoria do lançamento"
                    value={newCat}
                    onChange={(e) => handleQuickCatChange(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
                  >
                    {quickCats.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    aria-label="Nova descrição do lançamento"
                    value={quickSubs.includes(newDesc) ? newDesc : quickSubs[0]}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
                  >
                    {quickSubs.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <CurrencyInput
                    ariaLabel="Novo valor do lançamento"
                    value={newValor}
                    onChange={setNewValor}
                    onEnter={handleQuickSave}
                    className="w-full text-right"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    aria-label="Nova observação do lançamento"
                    value={newObs}
                    onChange={(e) => setNewObs(e.target.value)}
                    onKeyDown={handleQuickKeyDown}
                    placeholder="Observação rápida..."
                    className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
                  />
                </td>
                <td className="p-2">
                  <select
                    aria-label="Nova forma de pagamento"
                    value={newForma}
                    onChange={(e) => setNewForma(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    {formasPagamento.map((fp) => (
                      <option key={fp} value={fp}>
                        {fp}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    aria-label="Novo titular do lançamento"
                    value={newTitular}
                    onChange={(e) => setNewTitular(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    {titulares.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2 text-right">
                  <button
                    type="button"
                    onClick={handleQuickSave}
                    aria-label="Adicionar lançamento rápido"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Salvar</span>
                  </button>
                </td>
              </tr>

              {/* Existing Rows */}
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--text-muted)]">
                    Nenhum lançamento encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isEditing = editingId === tx.id && editDraft !== null;
                  if (isEditing && editDraft) {
                    const editCats = getCatsForType(editDraft.tipo);
                    const editSubs = getSubsForCat(
                      editDraft.tipo,
                      editDraft.categoria,
                    );

                    return (
                      <tr key={tx.id} className="bg-[var(--accent-soft-bg)]">
                        <td className="p-2">
                          <input
                            type="text"
                            aria-label="Editar data"
                            value={editDraft.data}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                data: maskBRDateInput(e.target.value),
                              })
                            }
                            onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                            className="w-full font-mono-nums bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            aria-label="Editar tipo"
                            value={editDraft.tipo}
                            onChange={(e) => {
                              const nextTipo = e.target.value as TransactionType;
                              const matching = getCatsForType(nextTipo);
                              const firstCat = matching[0];
                              setEditDraft({
                                ...editDraft,
                                tipo: nextTipo,
                                categoria: firstCat?.nome || editDraft.categoria,
                                descricao: firstCat?.subcategorias[0] || 'Outros',
                              });
                            }}
                            className="w-full bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          >
                            <option value="DESPESA">DESPESA</option>
                            <option value="RECEITA">RECEITA</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            aria-label="Editar categoria"
                            value={editDraft.categoria}
                            onChange={(e) => {
                              const nextCat = e.target.value;
                              const subs = getSubsForCat(editDraft.tipo, nextCat);
                              setEditDraft({
                                ...editDraft,
                                categoria: nextCat,
                                descricao: subs[0] || 'Outros',
                              });
                            }}
                            className="w-full bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          >
                            {editCats.map((c) => (
                              <option key={c.id} value={c.nome}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            aria-label="Editar descrição"
                            value={
                              editSubs.includes(editDraft.descricao)
                                ? editDraft.descricao
                                : editSubs[0]
                            }
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                descricao: e.target.value,
                              })
                            }
                            className="w-full bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          >
                            {editSubs.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <CurrencyInput
                            ariaLabel="Editar valor"
                            value={editDraft.valor}
                            onChange={(v) => setEditDraft({ ...editDraft, valor: v })}
                            onEnter={saveEditing}
                            className="w-full text-right"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            aria-label="Editar observação"
                            value={editDraft.obs}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, obs: e.target.value })
                            }
                            onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                            className="w-full bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            aria-label="Editar forma de pagamento"
                            value={editDraft.formaPagamento}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                formaPagamento: e.target.value,
                              })
                            }
                            className="w-full bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          >
                            {formasPagamento.map((fp) => (
                              <option key={fp} value={fp}>
                                {fp}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            aria-label="Editar titular"
                            value={editDraft.titular}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                titular: e.target.value,
                              })
                            }
                            className="w-full bg-[var(--bg-input)] border border-[var(--accent-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                          >
                            {titulares.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={saveEditing}
                              aria-label="Salvar edição"
                              className="p-1.5 rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditDraft(null);
                              }}
                              aria-label="Cancelar edição"
                              className="p-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-[var(--bg-surface-hover)] transition-colors h-11"
                    >
                      <td className="py-2.5 px-3 font-mono-nums text-xs sm:text-sm text-[var(--text-secondary)]">
                        {tx.data}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-mono-nums text-xs font-semibold ${
                            tx.tipo === 'RECEITA'
                              ? 'text-[var(--semantic-income)]'
                              : 'text-[var(--semantic-expense)]'
                          }`}
                        >
                          {tx.tipo === 'RECEITA' ? '+ RECEITA' : '- DESPESA'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                        {tx.categoria}
                      </td>
                      <td className="py-2.5 px-3 text-xs sm:text-sm text-[var(--text-primary)]">
                        {tx.descricao}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-nums font-semibold ${
                          tx.tipo === 'RECEITA'
                            ? 'text-[var(--semantic-income)]'
                            : 'text-[var(--semantic-expense)]'
                        }`}
                      >
                        {formatBRL(tx.valor)}
                      </td>
                      <td className="py-2.5 px-3 text-xs sm:text-sm text-[var(--text-muted)] max-w-xs truncate">
                        {tx.obs || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono-nums text-xs text-[var(--text-secondary)]">
                        {tx.formaPagamento}
                      </td>
                      <td className="py-2.5 px-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                        {tx.titular}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditing(tx)}
                            aria-label={`Editar ${tx.descricao} de ${tx.data}`}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx.id)}
                            aria-label={`Excluir ${tx.descricao} de ${tx.data}`}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--semantic-expense)] hover:bg-[var(--semantic-expense-bg)] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Footer */}
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-header)] px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
          <span className="text-[var(--text-muted)]">
            Exibindo{' '}
            <strong className="font-mono-nums text-[var(--text-primary)]">
              {filteredTransactions.length}
            </strong>{' '}
            lançamento(s)
          </span>
          <div className="flex flex-wrap items-center gap-6 font-mono-nums">
            <span className="text-[var(--text-muted)]">
              Receitas:{' '}
              <strong className="text-[var(--semantic-income)]">
                {formatBRL(totals.receitas)}
              </strong>
            </span>
            <span className="text-[var(--text-muted)]">
              Despesas:{' '}
              <strong className="text-[var(--semantic-expense)]">
                {formatBRL(totals.despesas)}
              </strong>
            </span>
            <span className="text-[var(--text-muted)]">
              Saldo:{' '}
              <strong
                className={
                  totals.saldo >= 0
                    ? 'text-[var(--semantic-income)]'
                    : 'text-[var(--semantic-expense)]'
                }
              >
                {formatBRL(totals.saldo, true)}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
