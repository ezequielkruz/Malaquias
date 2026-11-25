import type {
  BankAccount,
  CategoryConfig,
  FinanceStore,
  PeriodSnapshot,
  Transaction,
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

export const DEFAULT_BANKS: BankAccount[] = [
  {
    id: 'bank_nubank',
    nome: 'Nubank',
    saldoConta: 3420.5,
    descontoComprometido: 480.0,
    caixinhaCofrinho: 12500.0,
    investimentos: 28400.0,
    criptomoedas: 4150.0,
    faturaCC: 1680.4,
    dividendosRecebidos: 245.8,
  },
  {
    id: 'bank_mercadopago',
    nome: 'Mercado Pago',
    saldoConta: 1890.0,
    descontoComprometido: 120.0,
    caixinhaCofrinho: 5200.0,
    investimentos: 9600.0,
    criptomoedas: 850.0,
    faturaCC: 420.0,
    dividendosRecebidos: 78.3,
  },
];

function makeTx(
  id: string,
  dia: number,
  mes: number,
  ano: number,
  tipo: 'RECEITA' | 'DESPESA',
  categoria: string,
  descricao: string,
  valor: number,
  obs: string,
  formaPagamento: string,
  titular = 'ezequiel',
): Transaction {
  const data = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  return {
    id,
    data,
    mes,
    ano,
    tipo,
    categoria,
    descricao,
    valor,
    obs,
    formaPagamento,
    titular,
  };
}

function buildSeedPeriod(ano: number, mes: number, variation = 0): PeriodSnapshot {
  const lancamentos: Transaction[] = [
    makeTx(`tx_${ano}_${mes}_1`, 5, mes, ano, 'RECEITA', 'RECEITAS', 'Salário', 7800, 'Salário mensal líquido', 'PIXR', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_2`, 10, mes, ano, 'RECEITA', 'RECEITAS', 'Ticket Alimentação', 950, 'Benefício alimentação', 'PIXR', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_3`, 18, mes, ano, 'RECEITA', 'RECEITAS', 'Investimentos', 324.1 + variation * 12, 'Dividendos e rendimentos CDB', 'PIXR', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_4`, 6, mes, ano, 'DESPESA', 'CASA', 'Aluguel', 1950, 'Aluguel apartamento', 'PIXD', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_5`, 8, mes, ano, 'DESPESA', 'CASA', 'Conta de Luz', 218.4 + variation * 15, 'Enel residencial', 'PIXD', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_6`, 9, mes, ano, 'DESPESA', 'CASA', 'Conta de Internet', 129.9, 'Fibra 600MB', 'BOLETO', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_7`, 11, mes, ano, 'DESPESA', 'ALIMENTAÇÃO', 'Supermercado', 845.6 + variation * 40, 'Compra quinzenal', 'CC', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_8`, 14, mes, ano, 'DESPESA', 'ALIMENTAÇÃO', 'Açougue', 215.0 + variation * 10, 'Carnes da semana', 'PIXD', 'familia'),
    makeTx(`tx_${ano}_${mes}_9`, 15, mes, ano, 'DESPESA', 'ALIMENTAÇÃO', 'Restaurante', 164.5, 'Almoço domingo', 'CC', 'familia'),
    makeTx(`tx_${ano}_${mes}_10`, 16, mes, ano, 'DESPESA', 'TRANSPORTE', 'Combustível', 320.0 + variation * 20, 'Posto Shell', 'CC', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_11`, 19, mes, ano, 'DESPESA', 'SAÚDE', 'Medicamentos', 138.2, 'Drogasil', 'PIXD', 'familia'),
    makeTx(`tx_${ano}_${mes}_12`, 20, mes, ano, 'DESPESA', 'CELEBRAÇÕES', 'Dízimos e doações', 450.0, 'Contribuição mensal', 'PIXD', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_13`, 22, mes, ano, 'DESPESA', 'TRABALHO', 'Softwares/Ferramentas', 99.0, 'Assinatura produtividade', 'CC', 'ezequiel'),
    makeTx(`tx_${ano}_${mes}_14`, 24, mes, ano, 'DESPESA', 'LAZER', 'Streaming', 65.9, 'Assinaturas', 'CC', 'familia'),
  ];

  const bancos: BankAccount[] = DEFAULT_BANKS.map((b, idx) => ({
    ...b,
    id: `${b.id}_${ano}_${mes}`,
    investimentos: b.investimentos + mes * (idx === 0 ? 450 : 180),
  }));

  return {
    periodoKey: getPeriodKey(ano, mes),
    ano,
    mes,
    lancamentos,
    bancos,
    metas: {
      metaReceita: 9000,
      tetoDespesa: 6500,
      metaInvestimento: 1500,
    },
  };
}

export function createInitialFinanceStore(): FinanceStore {
  const periods: Record<string, PeriodSnapshot> = {};

  // Seed Jan, Feb, Mar, Oct, Nov 2026 so Monthly Dashboard and Annual Pivot have rich data
  const seedMonths = [
    { mes: 1, variation: 0 },
    { mes: 2, variation: 1 },
    { mes: 3, variation: -1 },
    { mes: 10, variation: 2 },
    { mes: 11, variation: 1 },
  ];

  for (const item of seedMonths) {
    const snap = buildSeedPeriod(2026, item.mes, item.variation);
    periods[snap.periodoKey] = snap;
  }

  return {
    version: '3.10',
    activeAno: 2026,
    activeMes: 2, // Default to FEV / 2026 as highlighted in prompt
    periods,
    categorias: DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      subcategorias: [...c.subcategorias],
    })),
    titulares: [...DEFAULT_TITULARES],
    formasPagamento: [...DEFAULT_PAYMENT_METHODS],
  };
}
