import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CreditCard, Plus, X } from 'lucide-react';
import type {
  CategoryConfig,
  CreditCardConfig,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  addMonthsToYearMonth,
  buildInstallmentPlan,
  getDefaultFirstInstallmentStart,
  type InstallmentValueMode,
} from '../utils/calculations';
import {
  formatBRL,
  getDefaultDateForPeriod,
  maskBRDateInput,
  MONTH_ABBR,
  parseBRDate,
} from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface TransactionModalProps {
  isOpen: boolean;
  initialTransaction?: Transaction | null;
  activeAno: number;
  activeMes: number;
  categories: CategoryConfig[];
  titulares: string[];
  formasPagamento: string[];
  cartoes: CreditCardConfig[];
  onAddCreditCard: (nome: string, diaVencimento: number) => CreditCardConfig | null;
  onClose: () => void;
  onSave: (txData: Omit<Transaction, 'id'>, existingId?: string) => void;
  onSaveBatch: (txs: Array<Omit<Transaction, 'id'>>) => void;
}

const INSTALLMENT_OPTIONS = Array.from({ length: 24 }, (_, idx) => idx + 1);

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  initialTransaction,
  activeAno,
  activeMes,
  categories,
  titulares,
  formasPagamento,
  cartoes,
  onAddCreditCard,
  onClose,
  onSave,
  onSaveBatch,
}) => {
  const [data, setData] = useState('');
  const [tipo, setTipo] = useState<TransactionType>('DESPESA');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(0);
  const [obs, setObs] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('PIXD');
  const [titular, setTitular] = useState('ezequiel');
  const [errorMsg, setErrorMsg] = useState('');

  // Credit card & installment states
  const [selectedCardId, setSelectedCardId] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [valorModo, setValorModo] = useState<InstallmentValueMode>('TOTAL');
  const [manualStartOffset, setManualStartOffset] = useState<0 | 1 | null>(null);

  // Quick-add card inline state inside modal
  const [showQuickCardForm, setShowQuickCardForm] = useState(false);
  const [quickCardName, setQuickCardName] = useState('');
  const [quickCardDueDay, setQuickCardDueDay] = useState('10');
  const [quickCardError, setQuickCardError] = useState('');

  const prevOpenRef = useRef(false);

  const filteredCategories = categories.filter((c) => c.tipo === tipo);
  const selectedCatObj =
    filteredCategories.find((c) => c.nome === categoria) || filteredCategories[0];
  const subcategories = selectedCatObj?.subcategorias || ['Outros'];

  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (!justOpened) return;
    setErrorMsg('');
    setShowQuickCardForm(false);
    setQuickCardName('');
    setQuickCardDueDay('10');
    setQuickCardError('');
    setManualStartOffset(null);

    if (initialTransaction) {
      setData(initialTransaction.data);
      setTipo(initialTransaction.tipo);
      setCategoria(initialTransaction.categoria);
      setDescricao(initialTransaction.descricao);
      setValor(initialTransaction.valor);
      setObs(initialTransaction.obs);
      setFormaPagamento(initialTransaction.formaPagamento);
      setTitular(initialTransaction.titular);
      setSelectedCardId(
        initialTransaction.cartaoId || cartoes[0]?.id || '',
      );
      setParcelas(1);
      setValorModo('TOTAL');
    } else {
      const defaultTipo: TransactionType = 'DESPESA';
      const defaultCat =
        categories.find((c) => c.tipo === defaultTipo) || categories[0];
      setData(getDefaultDateForPeriod(activeAno, activeMes, new Date().getDate()));
      setTipo(defaultTipo);
      setCategoria(defaultCat?.nome || 'ALIMENTAÇÃO');
      setDescricao(defaultCat?.subcategorias[0] || 'Outros');
      setValor(0);
      setObs('');
      setFormaPagamento(formasPagamento[0] || 'PIXD');
      setTitular(titulares[0] || 'ezequiel');
      setSelectedCardId(cartoes[0]?.id || '');
      setParcelas(1);
      setValorModo('TOTAL');
    }
  }, [
    isOpen,
    initialTransaction,
    activeAno,
    activeMes,
    categories,
    formasPagamento,
    titulares,
    cartoes,
  ]);

  const isCreditCard = formaPagamento.trim().toUpperCase() === 'CC';
  const selectedCard =
    cartoes.find((c) => c.id === selectedCardId) || cartoes[0] || null;
  const parsedDate = parseBRDate(data);

  const autoStartInfo = useMemo(() => {
    const refAno = parsedDate.isValid ? parsedDate.ano : activeAno;
    const refMes = parsedDate.isValid ? parsedDate.mes : activeMes;
    const refDia = parsedDate.isValid ? parsedDate.dia : 1;
    const dueDay = selectedCard?.diaVencimento ?? refDia;
    return getDefaultFirstInstallmentStart(refAno, refMes, refDia, dueDay);
  }, [parsedDate, activeAno, activeMes, selectedCard]);

  const effectiveStartOffset: 0 | 1 =
    manualStartOffset !== null
      ? manualStartOffset
      : autoStartInfo.isNextMonth
        ? 1
        : 0;

  const sameMonthLabel = useMemo(() => {
    const refAno = parsedDate.isValid ? parsedDate.ano : activeAno;
    const refMes = parsedDate.isValid ? parsedDate.mes : activeMes;
    return `${MONTH_ABBR[refMes - 1]}/${refAno}`;
  }, [parsedDate, activeAno, activeMes]);

  const nextMonthLabel = useMemo(() => {
    const refAno = parsedDate.isValid ? parsedDate.ano : activeAno;
    const refMes = parsedDate.isValid ? parsedDate.mes : activeMes;
    const next = addMonthsToYearMonth(refAno, refMes, 1);
    return `${MONTH_ABBR[next.mes - 1]}/${next.ano}`;
  }, [parsedDate, activeAno, activeMes]);

  const installmentPlan = useMemo(() => {
    if (!isCreditCard || initialTransaction || parcelas <= 1) {
      return null;
    }
    return buildInstallmentPlan({
      data: parsedDate.isValid
        ? data
        : getDefaultDateForPeriod(activeAno, activeMes, 1),
      tipo,
      categoria: selectedCatObj?.nome || categoria,
      descricao,
      valor,
      obs,
      formaPagamento,
      titular,
      card: selectedCard,
      parcelas,
      valorModo,
      primeiraParcelaOffset: effectiveStartOffset,
    });
  }, [
    isCreditCard,
    initialTransaction,
    parcelas,
    parsedDate.isValid,
    data,
    activeAno,
    activeMes,
    tipo,
    selectedCatObj,
    categoria,
    descricao,
    valor,
    obs,
    formaPagamento,
    titular,
    selectedCard,
    valorModo,
    effectiveStartOffset,
  ]);

  const handleTipoChange = (nextTipo: TransactionType) => {
    setTipo(nextTipo);
    const matching = categories.filter((c) => c.tipo === nextTipo);
    if (matching.length > 0) {
      setCategoria(matching[0].nome);
      setDescricao(matching[0].subcategorias[0] || 'Outros');
    }
  };

  const handleCategoryChange = (nextCat: string) => {
    setCategoria(nextCat);
    const catObj = filteredCategories.find((c) => c.nome === nextCat);
    if (catObj && catObj.subcategorias.length > 0) {
      setDescricao(catObj.subcategorias[0]);
    } else {
      setDescricao('Outros');
    }
  };

  const handleQuickCreateCard = () => {
    setQuickCardError('');
    const trimmed = quickCardName.trim();
    const due = parseInt(quickCardDueDay, 10);
    if (!trimmed) {
      setQuickCardError('Informe o nome do cartão.');
      return;
    }
    if (!Number.isFinite(due) || due < 1 || due > 31) {
      setQuickCardError('Dia de vencimento deve estar entre 1 e 31.');
      return;
    }
    const created = onAddCreditCard(trimmed, due);
    if (created) {
      setSelectedCardId(created.id);
      setQuickCardName('');
      setQuickCardDueDay('10');
      setShowQuickCardForm(false);
    } else {
      setQuickCardError('Já existe um cartão com esse nome.');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedDate.isValid) {
      setErrorMsg('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    if (valor <= 0) {
      setErrorMsg('Informe um valor maior que R$ 0,00.');
      return;
    }
    if (!categoria.trim() || !descricao.trim()) {
      setErrorMsg('Selecione a categoria e a descrição.');
      return;
    }
    if (isCreditCard && !selectedCard) {
      setErrorMsg('Cadastre ou selecione um cartão de crédito antes de salvar.');
      return;
    }

    if (initialTransaction) {
      onSave(
        {
          data,
          mes: parsedDate.mes,
          ano: parsedDate.ano,
          tipo,
          categoria: selectedCatObj?.nome || categoria,
          descricao,
          valor,
          obs: obs.trim(),
          formaPagamento,
          titular,
          ...(isCreditCard && selectedCard
            ? {
                cartaoId: selectedCard.id,
                cartaoNome: selectedCard.nome,
              }
            : {}),
          ...(initialTransaction.parcelaAtual
            ? { parcelaAtual: initialTransaction.parcelaAtual }
            : {}),
          ...(initialTransaction.totalParcelas
            ? { totalParcelas: initialTransaction.totalParcelas }
            : {}),
          ...(initialTransaction.parcelamentoGrupoId
            ? { parcelamentoGrupoId: initialTransaction.parcelamentoGrupoId }
            : {}),
        },
        initialTransaction.id,
      );
      onClose();
      return;
    }

    const plan = buildInstallmentPlan({
      data,
      tipo,
      categoria: selectedCatObj?.nome || categoria,
      descricao,
      valor,
      obs,
      formaPagamento,
      titular,
      card: isCreditCard ? selectedCard : null,
      parcelas: isCreditCard ? parcelas : 1,
      valorModo,
      primeiraParcelaOffset: effectiveStartOffset,
    });

    if (plan.items.length > 1) {
      onSaveBatch(plan.items);
    } else {
      onSave(plan.items[0]);
    }
    onClose();
  };

  const hasCentDifference =
    installmentPlan &&
    installmentPlan.items.length > 1 &&
    installmentPlan.items[0].valor !== installmentPlan.valorParcelaBase;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[var(--bg-modal-backdrop)] p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] flex flex-col max-h-[94vh] my-auto overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] shrink-0">
          <h2
            id="tx-modal-title"
            className="font-display text-lg font-semibold text-[var(--text-primary)]"
          >
            {initialTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de lançamento"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-lg border border-[var(--semantic-expense)]/30 bg-[var(--semantic-expense-bg)] text-[var(--semantic-expense)] text-sm"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="modal-tx-data"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Data (DD/MM/AAAA)
              </label>
              <input
                id="modal-tx-data"
                type="text"
                value={data}
                onChange={(e) => setData(maskBRDateInput(e.target.value))}
                placeholder="DD/MM/AAAA"
                className="w-full font-mono-nums bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
              />
              {parsedDate.isValid && (
                <p className="mt-1 text-xs text-[var(--text-muted)] font-mono-nums">
                  Competência automática: {String(parsedDate.mes).padStart(2, '0')}/
                  {parsedDate.ano}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Tipo
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTipoChange('RECEITA')}
                  className={`py-2 px-3 rounded-md text-sm font-semibold border transition-colors cursor-pointer ${
                    tipo === 'RECEITA'
                      ? 'bg-[var(--semantic-income-bg)] border-[var(--semantic-income)] text-[var(--semantic-income)]'
                      : 'bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  + RECEITA
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoChange('DESPESA')}
                  className={`py-2 px-3 rounded-md text-sm font-semibold border transition-colors cursor-pointer ${
                    tipo === 'DESPESA'
                      ? 'bg-[var(--semantic-expense-bg)] border-[var(--semantic-expense)] text-[var(--semantic-expense)]'
                      : 'bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  - DESPESA
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="modal-tx-categoria"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Categoria
              </label>
              <select
                id="modal-tx-categoria"
                value={selectedCatObj?.nome || categoria}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="modal-tx-descricao"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Descrição (Subcategoria)
              </label>
              <select
                id="modal-tx-descricao"
                value={subcategories.includes(descricao) ? descricao : subcategories[0]}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
              >
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="modal-tx-valor"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                {isCreditCard && !initialTransaction && parcelas > 1
                  ? valorModo === 'TOTAL'
                    ? 'Valor Total (R$)'
                    : 'Valor da Parcela (R$)'
                  : 'Valor (R$)'}
              </label>
              <CurrencyInput
                id="modal-tx-valor"
                value={valor}
                onChange={setValor}
                ariaLabel="Valor do lançamento"
                className="w-full py-2"
              />
            </div>

            <div>
              <label
                htmlFor="modal-tx-forma"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Pago / Forma
              </label>
              <select
                id="modal-tx-forma"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
              >
                {formasPagamento.map((fp) => (
                  <option key={fp} value={fp}>
                    {fp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="modal-tx-titular"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Titular
              </label>
              <select
                id="modal-tx-titular"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
              >
                {titulares.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Credit Card & Installment Panel */}
          {isCreditCard && (
            <div
              data-testid="cc-options-panel"
              className="rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--card-blue-bg)] p-3.5 sm:p-4 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard
                    className="w-4 h-4 text-[var(--accent-blue)] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--accent-blue)]">
                    Cartão de Crédito
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setQuickCardError('');
                    setShowQuickCardForm((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--accent-blue-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-xs font-semibold text-[var(--accent-blue)] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{showQuickCardForm ? 'Fechar novo cartão' : 'Novo cartão'}</span>
                </button>
              </div>

              {showQuickCardForm && (
                <div className="rounded-lg border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Cadastrar novo cartão rapidamente
                  </p>
                  {quickCardError && (
                    <p role="alert" className="text-xs text-[var(--semantic-expense)]">
                      {quickCardError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <label htmlFor="modal-new-card-name" className="sr-only">
                        Nome do novo cartão
                      </label>
                      <input
                        id="modal-new-card-name"
                        type="text"
                        value={quickCardName}
                        onChange={(e) => setQuickCardName(e.target.value)}
                        placeholder="Nome (ex: Inter, Itaú)"
                        className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label htmlFor="modal-new-card-due" className="sr-only">
                        Dia do vencimento (1 a 31)
                      </label>
                      <input
                        id="modal-new-card-due"
                        type="number"
                        min={1}
                        max={31}
                        value={quickCardDueDay}
                        onChange={(e) => setQuickCardDueDay(e.target.value)}
                        placeholder="Dia venc."
                        title="Dia de vencimento da fatura (1 a 31)"
                        className="w-full font-mono-nums bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleQuickCreateCard}
                        className="w-full py-1.5 px-3 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-xs font-semibold cursor-pointer"
                      >
                        Salvar Cartão
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`grid grid-cols-1 ${
                  !initialTransaction ? 'sm:grid-cols-2' : ''
                } gap-3`}
              >
                <div>
                  <label
                    htmlFor="modal-tx-cartao"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Cartão
                  </label>
                  {cartoes.length === 0 ? (
                    <p className="text-xs text-[var(--semantic-expense)] py-2">
                      Nenhum cartão cadastrado. Clique em &quot;+ Novo cartão&quot; acima.
                    </p>
                  ) : (
                    <select
                      id="modal-tx-cartao"
                      value={selectedCard?.id || ''}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
                    >
                      {cartoes.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.nome} (Venc. dia{' '}
                          {String(card.diaVencimento).padStart(2, '0')})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {!initialTransaction && (
                  <div>
                    <label
                      htmlFor="modal-tx-parcelas"
                      className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                    >
                      Parcelamento
                    </label>
                    <select
                      id="modal-tx-parcelas"
                      value={parcelas}
                      onChange={(e) => setParcelas(Number(e.target.value))}
                      className="w-full font-mono-nums bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
                    >
                      {INSTALLMENT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? '1x (À vista)' : `${n}x parcelado`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!initialTransaction && parcelas > 1 && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        Valor informado representa:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setValorModo('TOTAL')}
                          className={`py-1.5 px-2.5 rounded-md text-xs font-semibold border-[1.5px] transition-colors cursor-pointer ${
                            valorModo === 'TOTAL'
                              ? 'bg-[var(--card-gold-bg)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          Valor Total
                        </button>
                        <button
                          type="button"
                          onClick={() => setValorModo('PARCELA')}
                          className={`py-1.5 px-2.5 rounded-md text-xs font-semibold border-[1.5px] transition-colors cursor-pointer ${
                            valorModo === 'PARCELA'
                              ? 'bg-[var(--card-gold-bg)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          Por Parcela
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        1ª Parcela na fatura de:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setManualStartOffset(0)}
                          className={`py-1.5 px-2 rounded-md text-xs font-mono-nums font-semibold border-[1.5px] transition-colors cursor-pointer ${
                            effectiveStartOffset === 0
                              ? 'bg-[var(--card-gold-bg)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {sameMonthLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualStartOffset(1)}
                          className={`py-1.5 px-2 rounded-md text-xs font-mono-nums font-semibold border-[1.5px] transition-colors cursor-pointer ${
                            effectiveStartOffset === 1
                              ? 'bg-[var(--card-gold-bg)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {nextMonthLabel}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Installment Schedule Preview */}
                  {installmentPlan && (
                    <div
                      data-testid="installment-preview"
                      className="rounded-lg border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                          <CalendarDays
                            className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0"
                            aria-hidden="true"
                          />
                          Prévia das {parcelas} parcelas
                          {selectedCard ? ` · ${selectedCard.nome}` : ''}
                        </span>
                        <span className="font-mono-nums font-bold text-[var(--text-primary)]">
                          {parcelas}x de {formatBRL(installmentPlan.valorParcelaBase)} ·
                          Total {formatBRL(installmentPlan.totalValor)}
                        </span>
                      </div>

                      {hasCentDifference && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Diferença de centavos ajustada na 1ª parcela (
                          {formatBRL(installmentPlan.items[0].valor)}) para fechar o
                          total exato.
                        </p>
                      )}

                      <ul className="max-h-36 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs font-mono-nums pr-1">
                        {installmentPlan.items.map((item) => (
                          <li
                            key={item.parcelaAtual}
                            className="py-1.5 flex items-center justify-between gap-2 text-[var(--text-secondary)]"
                          >
                            <span>
                              <strong className="text-[var(--text-primary)]">
                                {item.parcelaAtual}/{item.totalParcelas}
                              </strong>{' '}
                              · {item.data} ({MONTH_ABBR[item.mes - 1]}/{item.ano})
                            </span>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatBRL(item.valor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="modal-tx-obs"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Observação
            </label>
            <input
              id="modal-tx-obs"
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Loja, pessoa ou detalhe adicional..."
              className="w-full bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
            />
          </div>
          </div>

          <div className="px-5 sm:px-6 py-3.5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-header)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-sm font-semibold text-[var(--accent-primary-text)] transition-colors cursor-pointer"
            >
              {initialTransaction
                ? 'Salvar Alterações'
                : isCreditCard && parcelas > 1
                  ? `Gerar ${parcelas} Parcelas`
                  : 'Adicionar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
