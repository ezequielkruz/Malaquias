import React, { useState } from 'react';
import { CreditCard, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import type { CategoryConfig, TransactionType } from '../types/finance';

interface CategoriasTabProps {
  categories: CategoryConfig[];
  titulares: string[];
  formasPagamento: string[];
  onAddCategory: (nome: string, tipo: TransactionType) => void;
  onDeleteCategory: (id: string) => void;
  onAddSubcategory: (categoryId: string, subName: string) => void;
  onDeleteSubcategory: (categoryId: string, subName: string) => void;
  onAddTitular: (name: string) => void;
  onDeleteTitular: (name: string) => void;
  onAddFormaPagamento: (name: string) => void;
  onDeleteFormaPagamento: (name: string) => void;
  onOpenResetModal: () => void;
}

export const CategoriasTab: React.FC<CategoriasTabProps> = ({
  categories,
  titulares,
  formasPagamento,
  onAddCategory,
  onDeleteCategory,
  onAddSubcategory,
  onDeleteSubcategory,
  onAddTitular,
  onDeleteTitular,
  onAddFormaPagamento,
  onDeleteFormaPagamento,
  onOpenResetModal,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('DESPESA');
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [newTitular, setNewTitular] = useState('');
  const [newForma, setNewForma] = useState('');

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim().toUpperCase();
    if (!trimmed) return;
    onAddCategory(trimmed, newCatType);
    setNewCatName('');
  };

  const handleCreateSub = (catId: string, e: React.FormEvent) => {
    e.preventDefault();
    const val = (subInputs[catId] || '').trim();
    if (!val) return;
    onAddSubcategory(catId, val);
    setSubInputs((prev) => ({ ...prev, [catId]: '' }));
  };

  const handleCreateTitular = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newTitular.trim().toLowerCase();
    if (!val) return;
    onAddTitular(val);
    setNewTitular('');
  };

  const handleCreateForma = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newForma.trim().toUpperCase();
    if (!val) return;
    onAddFormaPagamento(val);
    setNewForma('');
  };

  return (
    <section aria-label="Configuração de Categorias" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Categorias, Titulares e Formas de Pagamento
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Personalize os grupos e descrições disponíveis nas listas dinâmicas do Controle
          </p>
        </div>

        <form
          onSubmit={handleCreateCategory}
          className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <label htmlFor="new-cat-name" className="sr-only">
            Nome da nova categoria
          </label>
          <input
            id="new-cat-name"
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Nova categoria (ex: VIAGENS)"
            className="w-full sm:w-52 bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
          />
          <label htmlFor="new-cat-type" className="sr-only">
            Tipo da nova categoria
          </label>
          <select
            id="new-cat-type"
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as TransactionType)}
            className="w-full sm:w-auto bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-underline)]"
          >
            <option value="DESPESA">DESPESA</option>
            <option value="RECEITA">RECEITA</option>
          </select>
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-text)] text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Adicionar Categoria</span>
          </button>
        </form>
      </div>

      {/* Titulares & Formas de Pagamento Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Titulares */}
        <div className="rounded-xl border-[1.5px] border-[var(--card-blue-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-[var(--accent-blue)] shrink-0" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                Titulares (Responsáveis)
              </h2>
            </div>
            <span className="font-mono-nums text-xs font-semibold px-2 py-0.5 rounded border border-[var(--accent-blue-border)] bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] whitespace-nowrap shrink-0">
              {titulares.length} cadastrados
            </span>
          </div>

          <form
            onSubmit={handleCreateTitular}
            className="flex flex-col sm:flex-row gap-2"
          >
            <label htmlFor="new-titular-input" className="sr-only">
              Novo titular
            </label>
            <input
              id="new-titular-input"
              type="text"
              value={newTitular}
              onChange={(e) => setNewTitular(e.target.value)}
              placeholder="Adicionar titular (ex: ana)"
              className="flex-1 min-w-0 bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-[var(--accent-gold-bg)] hover:opacity-90 border-[1.5px] border-[var(--accent-gold-border)] text-[var(--text-primary)] text-xs font-semibold transition-opacity cursor-pointer"
            >
              Adicionar
            </button>
          </form>

          <div className="divide-y divide-[var(--border-subtle)]">
            {titulares.map((t) => (
              <div
                key={t}
                className="py-2 flex items-center justify-between text-sm text-[var(--text-secondary)]"
              >
                <span>{t}</span>
                {titulares.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteTitular(t)}
                    aria-label={`Remover titular ${t}`}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--semantic-expense)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Formas de Pagamento */}
        <div className="rounded-xl border-[1.5px] border-[var(--card-income-border)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard className="w-4 h-4 text-[var(--semantic-income)] shrink-0" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                Formas de Pagamento
              </h2>
            </div>
            <span className="font-mono-nums text-xs font-semibold px-2 py-0.5 rounded border border-[var(--accent-blue-border)] bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] whitespace-nowrap shrink-0">
              {formasPagamento.length} ativas
            </span>
          </div>

          <form
            onSubmit={handleCreateForma}
            className="flex flex-col sm:flex-row gap-2"
          >
            <label htmlFor="new-forma-input" className="sr-only">
              Nova forma de pagamento
            </label>
            <input
              id="new-forma-input"
              type="text"
              value={newForma}
              onChange={(e) => setNewForma(e.target.value)}
              placeholder="Nova forma (ex: DEBITO)"
              className="flex-1 min-w-0 bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-[var(--accent-gold-bg)] hover:opacity-90 border-[1.5px] border-[var(--accent-gold-border)] text-[var(--text-primary)] text-xs font-semibold transition-opacity cursor-pointer"
            >
              Adicionar
            </button>
          </form>

          <div className="divide-y divide-[var(--border-subtle)]">
            {formasPagamento.map((fp) => (
              <div
                key={fp}
                className="py-2 flex items-center justify-between text-sm text-[var(--text-secondary)] font-mono-nums"
              >
                <span>{fp}</span>
                {formasPagamento.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteFormaPagamento(fp)}
                    aria-label={`Remover forma de pagamento ${fp}`}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--semantic-expense)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories & Subcategories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] [box-shadow:var(--card-shadow)] p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    {cat.nome}
                  </h3>
                  <span
                    className={`text-xs font-semibold ${
                      cat.tipo === 'RECEITA'
                        ? 'text-[var(--semantic-income)]'
                        : 'text-[var(--semantic-expense)]'
                    }`}
                  >
                    {cat.tipo} · {cat.subcategorias.length} itens
                  </span>
                </div>

                {categories.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(cat.id)}
                    aria-label={`Excluir categoria ${cat.nome}`}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--semantic-expense)] hover:bg-[var(--semantic-expense-bg)] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <ul className="mt-3 divide-y divide-[var(--border-subtle)] max-h-56 overflow-y-auto pr-1">
                {cat.subcategorias.map((sub) => (
                  <li
                    key={sub}
                    className="py-1.5 flex items-center justify-between text-xs sm:text-sm text-[var(--text-secondary)]"
                  >
                    <span>{sub}</span>
                    {cat.subcategorias.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSubcategory(cat.id, sub)}
                        aria-label={`Remover subcategoria ${sub} de ${cat.nome}`}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--semantic-expense)] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <form
              onSubmit={(e) => handleCreateSub(cat.id, e)}
              className="pt-2 border-t border-[var(--border-subtle)] flex gap-2"
            >
              <label htmlFor={`add-sub-${cat.id}`} className="sr-only">
                Nova subcategoria para {cat.nome}
              </label>
              <input
                id={`add-sub-${cat.id}`}
                type="text"
                value={subInputs[cat.id] || ''}
                onChange={(e) =>
                  setSubInputs((prev) => ({
                    ...prev,
                    [cat.id]: e.target.value,
                  }))
                }
                placeholder="Nova subcategoria..."
                className="flex-1 min-w-0 bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
              />
              <button
                type="submit"
                aria-label={`Adicionar subcategoria em ${cat.nome}`}
                className="shrink-0 px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface-hover)] border-[1.5px] border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                + Add
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Reset / Modo Amigo Section */}
      <div className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] [box-shadow:var(--card-shadow)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RotateCcw
              className="w-4 h-4 text-[var(--accent-gold)] shrink-0"
              aria-hidden="true"
            />
            <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
              Limpar Lançamentos ou Zerar Dados (Modo Amigo)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Apague apenas os lançamentos ou zere também os saldos bancários mantendo suas
            Categorias, Subcategorias, Titulares e Formas de Pagamento prontos para começar do zero.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenResetModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-[1.5px] border-[var(--accent-gold-border)] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] text-[var(--accent-gold-text)] text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>Limpar / Começar do Zero</span>
        </button>
      </div>
    </section>
  );
};

