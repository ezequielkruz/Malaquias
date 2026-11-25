import type { FinanceStore } from '../types/finance';
import { createInitialFinanceStore, DEFAULT_CREDIT_CARDS } from '../data/defaults';

const STORAGE_KEY = 'gestor_financeiro_3_10_store';

export function loadFinanceStore(): FinanceStore {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialFinanceStore();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialFinanceStore();
      saveFinanceStore(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as FinanceStore;
    if (!parsed || typeof parsed !== 'object' || !parsed.periods) {
      return createInitialFinanceStore();
    }
    if (!Array.isArray(parsed.cartoes)) {
      return {
        ...parsed,
        cartoes: DEFAULT_CREDIT_CARDS.map((c) => ({ ...c })),
      };
    }
    return parsed;
  } catch {
    return createInitialFinanceStore();
  }
}

export function saveFinanceStore(store: FinanceStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors silently
  }
}

export function resetFinanceStore(): FinanceStore {
  const initial = createInitialFinanceStore();
  saveFinanceStore(initial);
  return initial;
}
