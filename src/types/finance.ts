export type TransactionType = 'RECEITA' | 'DESPESA';

export type TabId = 'resumo' | 'controle' | 'bancos' | 'anual' | 'categorias';

export interface Transaction {
  id: string;
  updatedAt?: string; // ISO 8601 timestamp da última modificação
  data: string; // DD/MM/AAAA
  mes: number; // 1-12
  ano: number; // e.g., 2026
  tipo: TransactionType;
  categoria: string;
  descricao: string;
  valor: number;
  obs: string;
  formaPagamento: string;
  titular: string;
  cartaoId?: string;
  cartaoNome?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  parcelamentoGrupoId?: string;
}

export interface CreditCardConfig {
  id: string;
  updatedAt?: string;
  nome: string;
  diaVencimento: number; // 1-31
}

export interface BankAccount {
  id: string;
  updatedAt?: string;
  nome: string;
  saldoConta: number;
  descontoComprometido: number;
  caixinhaCofrinho: number;
  investimentos: number;
  criptomoedas: number;
  faturaCC: number;
  dividendosRecebidos: number;
}

export interface CategoryConfig {
  id: string;
  updatedAt?: string;
  nome: string;
  tipo: TransactionType;
  subcategorias: string[];
}

export interface PeriodGoals {
  metaReceita?: number;
  tetoDespesa?: number;
  metaInvestimento?: number;
}

export interface PeriodSnapshot {
  periodoKey: string; // "YYYY-MM"
  ano: number;
  mes: number;
  lancamentos: Transaction[];
  bancos: BankAccount[];
  metas: PeriodGoals;
}

export interface FinanceStore {
  version: string;
  activeAno: number;
  activeMes: number;
  periods: Record<string, PeriodSnapshot>; // keyed by "YYYY-MM"
  categorias: CategoryConfig[];
  titulares: string[];
  formasPagamento: string[];
  cartoes: CreditCardConfig[];
}

export interface PeriodExportPayload {
  schemaVersion: string; // "1.0"
  appVersion: string; // "3.10"
  exportType: 'period';
  exportedAt: string; // ISO timestamp
  periodo: string; // "YYYY-MM"
  exportadoEm: string; // ISO timestamp (compat)
  transacoes: Transaction[];
  bancos: BankAccount[];
  categorias: CategoryConfig[];
  cartoes?: CreditCardConfig[];
  metas?: PeriodGoals;
}

export interface FullBackupExportPayload {
  schemaVersion: string; // "2.0"
  appVersion: string; // "3.10"
  exportType: 'full';
  exportedAt: string; // ISO timestamp
  exportadoEm: string; // ISO timestamp (compat)
  activeAno: number;
  activeMes: number;
  periods: Record<string, PeriodSnapshot>;
  categorias: CategoryConfig[];
  titulares: string[];
  formasPagamento: string[];
  cartoes: CreditCardConfig[];
}
