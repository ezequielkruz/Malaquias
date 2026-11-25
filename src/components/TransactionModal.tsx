import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { CategoryConfig, Transaction, TransactionType } from '../types/finance';
import {
  getDefaultDateForPeriod,
  maskBRDateInput,
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
  onClose: () => void;
  onSave: (txData: Omit<Transaction, 'id'>, existingId?: string) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  initialTransaction,
  activeAno,
  activeMes,
  categories,
  titulares,
  formasPagamento,
  onClose,
  onSave,
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

  const filteredCategories = categories.filter((c) => c.tipo === tipo);
  const selectedCatObj =
    filteredCategories.find((c) => c.nome === categoria) || filteredCategories[0];
  const subcategories = selectedCatObj?.subcategorias || ['Outros'];

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (initialTransaction) {
      setData(initialTransaction.data);
      setTipo(initialTransaction.tipo);
      setCategoria(initialTransaction.categoria);
      setDescricao(initialTransaction.descricao);
      setValor(initialTransaction.valor);
      setObs(initialTransaction.obs);
      setFormaPagamento(initialTransaction.formaPagamento);
      setTitular(initialTransaction.titular);
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
    }
  }, [isOpen, initialTransaction, activeAno, activeMes, categories, formasPagamento, titulares]);

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

  if (!isOpen) return null;

  const parsedDate = parseBRDate(data);

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
      },
      initialTransaction?.id,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-modal-backdrop)] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
          <h2 id="tx-modal-title" className="font-display text-lg font-semibold text-[var(--text-primary)]">
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
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
                  Competência automática: {String(parsedDate.mes).padStart(2, '0')}/{parsedDate.ano}
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
                Valor (R$)
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

          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-sm font-semibold text-[var(--accent-primary-text)] transition-colors cursor-pointer"
            >
              {initialTransaction ? 'Salvar Alterações' : 'Adicionar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
