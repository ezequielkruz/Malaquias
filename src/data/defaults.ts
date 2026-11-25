import type {
  BankAccount,
  CategoryConfig,
  CreditCardConfig,
  FinanceStore,
  PeriodSnapshot,
} from '../types/finance';
import { getPeriodKey } from '../utils/format';

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    id: 'cat_receitas',
    nome: 'RECEITAS',
    tipo: 'RECEITA',
    subcategorias: [
      'Salário',
      '13º salário',
      'Férias',
      'Bônus',
      'Casa Aluguel',
      'Criptomoedas',
      'Empréstimos',
      'Extras(temporários)',
      'Investimentos',
      'Ticket Alimentação',
      'Vendas',
      'Outros',
    ],
  },
  {
    id: 'cat_alimentacao',
    nome: 'ALIMENTAÇÃO',
    tipo: 'DESPESA',
    subcategorias: [
      'Supermercado',
      'Açougue',
      'Hortifruti',
      'Padaria',
      'Feira',
      'Mercearia',
      'Lanchonete',
      'Restaurante',
      'Pizzaria',
      'Sorveteria',
      'Doceria',
      'Conveniência',
      'Casa Utilidades',
      'Outros',
    ],
  },
  {
    id: 'cat_casa',
    nome: 'CASA',
    tipo: 'DESPESA',
    subcategorias: [
      'Aluguel',
      'Condomínio',
      'Conta de Água',
      'Conta de Luz',
      'Conta de Gás',
      'Conta de Internet',
      'Conta de Celular',
      'Financiamento Imobiliário',
      'IPTU',
      'Diarista',
      'Mensalista',
      'Eletrodomésticos',
      'Utensílios',
      'Reformas/Consertos',
      'Seguro',
      'Animais(ração, remédios)',
      'Outros',
    ],
  },
  {
    id: 'cat_celebracoes',
    nome: 'CELEBRAÇÕES',
    tipo: 'DESPESA',
    subcategorias: ['Dízimos e doações', 'Presentes', 'Festa', 'Outros'],
  },
  {
    id: 'cat_dividas',
    nome: 'DÍVIDAS',
    tipo: 'DESPESA',
    subcategorias: ['Empréstimo Bancário', 'Parcelamento Cartão', 'Financiamento', 'Acordos', 'Outros'],
  },
  {
    id: 'cat_educacao',
    nome: 'EDUCAÇÃO',
    tipo: 'DESPESA',
    subcategorias: ['Mensalidade', 'Cursos', 'Livros', 'Material Escolar', 'Outros'],
  },
  {
    id: 'cat_higiene',
    nome: 'HIGIENE',
    tipo: 'DESPESA',
    subcategorias: ['Farmácia Higiene', 'Perfumaria', 'Barbearia/Salão', 'Outros'],
  },
  {
    id: 'cat_imposto',
    nome: 'IMPOSTO',
    tipo: 'DESPESA',
    subcategorias: ['INSS', 'Imposto de Renda', 'Taxas Bancárias/Gov', 'Outros'],
  },
  {
    id: 'cat_investimentos',
    nome: 'INVESTIMENTOS',
    tipo: 'DESPESA',
    subcategorias: ['Aporte Renda Fixa', 'Aporte FIIs/Ações', 'Aporte Criptomoedas', 'Reserva de Emergência', 'Outros'],
  },
  {
    id: 'cat_lazer',
    nome: 'LAZER',
    tipo: 'DESPESA',
    subcategorias: ['Streaming', 'Cinema/Teatro', 'Viagens', 'Passeios', 'Jogos', 'Outros'],
  },
  {
    id: 'cat_saude',
    nome: 'SAÚDE',
    tipo: 'DESPESA',
    subcategorias: ['Medicamentos', 'Consultas', 'Exames', 'Plano de Saúde', 'Odontologia', 'Outros'],
  },
  {
    id: 'cat_trabalho',
    nome: 'TRABALHO',
    tipo: 'DESPESA',
    subcategorias: ['Equipamentos', 'Softwares/Ferramentas', 'Transporte Trabalho', 'Almoço Trabalho', 'Outros'],
  },
  {
    id: 'cat_transporte',
    nome: 'TRANSPORTE',
    tipo: 'DESPESA',
    subcategorias: ['Transporte público', 'Combustível', 'Manutenção', 'Estacionamento', 'Aplicativo', 'IPVA/Seguro', 'Outros'],
  },
];

export const DEFAULT_TITULARES = ['ezequiel', 'familia'];

export const DEFAULT_PAYMENT_METHODS = ['PIXD', 'PIXR', 'CC', 'DINHEIRO', 'BOLETO'];

export const DEFAULT_CREDIT_CARDS: CreditCardConfig[] = [
  {
    id: 'cc_nubank',
    nome: 'Nubank',
    diaVencimento: 10,
  },
  {
    id: 'cc_santander',
    nome: 'Santander',
    diaVencimento: 15,
  },
];

export const DEFAULT_BANKS: BankAccount[] = [
  {
    id: 'bank_nubank',
    nome: 'Nubank',
    saldoConta: 0,
    descontoComprometido: 0,
    caixinhaCofrinho: 0,
    investimentos: 0,
    criptomoedas: 0,
    faturaCC: 0,
    dividendosRecebidos: 0,
  },
  {
    id: 'bank_mercadopago',
    nome: 'Mercado Pago',
    saldoConta: 0,
    descontoComprometido: 0,
    caixinhaCofrinho: 0,
    investimentos: 0,
    criptomoedas: 0,
    faturaCC: 0,
    dividendosRecebidos: 0,
  },
];

export function createInitialFinanceStore(): FinanceStore {
  const now = new Date();
  const activeAno = now.getFullYear();
  const activeMes = now.getMonth() + 1;
  const initialKey = getPeriodKey(activeAno, activeMes);

  const initialPeriod: PeriodSnapshot = {
    periodoKey: initialKey,
    ano: activeAno,
    mes: activeMes,
    lancamentos: [],
    bancos: DEFAULT_BANKS.map((b) => ({ ...b })),
    metas: {},
  };

  return {
    version: '3.10',
    activeAno,
    activeMes,
    periods: {
      [initialKey]: initialPeriod,
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

