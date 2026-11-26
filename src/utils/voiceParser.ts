import type {
  CategoryConfig,
  CreditCardConfig,
  TransactionType,
} from '../types/finance';

export interface VoiceParseContext {
  categories: CategoryConfig[];
  formasPagamento: string[];
  cartoes: CreditCardConfig[];
  titulares: string[];
}

export interface ParsedVoiceTransaction {
  transcript: string;
  tipo: TransactionType;
  valor: number | null;
  formaPagamento: string;
  cartaoId?: string;
  cartaoNome?: string;
  parcelas: number;
  categoria: string;
  descricao: string;
  titular?: string;
  obs: string;
}

export function normalizeSpeechText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PT_UNITS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  meia: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};

const PT_TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};

const PT_HUNDREDS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};

function parsePortugueseNumberWords(phrase: string): number | null {
  const tokens = phrase
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let current = 0;
  let total = 0;
  let foundAny = false;

  for (const tok of tokens) {
    if (tok === 'e') continue;
    if (tok === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
      foundAny = true;
    } else if (tok in PT_HUNDREDS) {
      current += PT_HUNDREDS[tok];
      foundAny = true;
    } else if (tok in PT_TENS) {
      current += PT_TENS[tok];
      foundAny = true;
    } else if (tok in PT_UNITS) {
      current += PT_UNITS[tok];
      foundAny = true;
    } else if (foundAny) {
      break;
    }
  }

  if (!foundAny) return null;
  return total + current;
}

export function extractInstallmentsFromSpeech(normalized: string): number {
  const patterns = [
    /\b(?:em\s+)?(\d{1,2})\s*x\b/,
    /\b(?:em\s+)?(\d{1,2})\s*vezes\b/,
    /\bparcelado\s+(?:em\s+)?(\d{1,2})\b/,
    /\b(?:em\s+)?(\d{1,2})\s*parcelas?\b/,
  ];

  for (const regex of patterns) {
    const m = regex.exec(normalized);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1 && n <= 24) {
        return n;
      }
    }
  }

  // Also check written number before "vezes" / "parcelas" (e.g. "em tres vezes")
  const wordMatch = /\b(?:em\s+)?([a-z]+)\s+(?:vezes|parcelas?)\b/.exec(normalized);
  if (wordMatch && wordMatch[1] in PT_UNITS) {
    const n = PT_UNITS[wordMatch[1]];
    if (n >= 1 && n <= 24) return n;
  }

  return 1;
}

export function extractAmountFromSpeech(rawTranscript: string): number | null {
  const norm = normalizeSpeechText(rawTranscript);

  // Strip installment tokens & explicit date phrases so "em 3x" or "dia 15" aren't parsed as R$
  const cleaned = norm
    .replace(/\b(?:em\s+)?\d{1,2}\s*x\b/g, ' ')
    .replace(/\b(?:em\s+)?\d{1,2}\s*vezes\b/g, ' ')
    .replace(/\bparcelado\s+(?:em\s+)?\d{1,2}\b/g, ' ')
    .replace(/\b(?:em\s+)?\d{1,2}\s*parcelas?\b/g, ' ')
    .replace(/\bdia\s+\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ');

  // 1. "120 reais e 50" / "120 e 50" / "120 reais e 50 centavos"
  const reaisECentavos =
    /(?:r\$\s*)?(\d+(?:\.\d{3})*)\s*(?:reais|real)?\s+e\s+(\d{1,2})(?:\s*centavos?)?\b/.exec(
      cleaned,
    );
  if (reaisECentavos) {
    const intPart = parseInt(reaisECentavos[1].replace(/\./g, ''), 10);
    const centDigits = reaisECentavos[2].padEnd(2, '0').slice(0, 2);
    const cents = parseInt(centDigits, 10);
    const val = intPart + cents / 100;
    if (val > 0) return Number(val.toFixed(2));
  }

  // 2. Formatted BR currency / decimal: "R$ 1.250,50", "85,00", "120.50"
  const brDecimalMatch =
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2})\b/.exec(cleaned);
  if (brDecimalMatch) {
    const parsed = Number(
      brDecimalMatch[1].replace(/\./g, '').replace(',', '.'),
    );
    if (Number.isFinite(parsed) && parsed > 0) return Number(parsed.toFixed(2));
  }

  // 3. Explicit "R$ 85" or "85.50" or "50 reais"
  const dotDecimalOrCurrency =
    /r\$\s*(\d+(?:\.\d{1,2})?)\b|\b(\d+\.\d{1,2})\b|\b(\d+(?:\.\d{3})*)\s*(?:reais|real)\b/.exec(
      cleaned,
    );
  if (dotDecimalOrCurrency) {
    const rawNum =
      dotDecimalOrCurrency[1] ||
      dotDecimalOrCurrency[2] ||
      dotDecimalOrCurrency[3].replace(/\./g, '');
    const parsed = Number(rawNum);
    if (Number.isFinite(parsed) && parsed > 0) return Number(parsed.toFixed(2));
  }

  // 4. Only centavos: "80 centavos"
  const onlyCents = /\b(\d{1,2})\s*centavos?\b/.exec(cleaned);
  if (onlyCents) {
    const cents = parseInt(onlyCents[1], 10);
    if (cents > 0) return Number((cents / 100).toFixed(2));
  }

  // 5. Bare number: "mercado 50" or "gastei 140 no posto"
  const bareNum = /\b(\d+(?:\.\d{1,2})?)\b/.exec(cleaned);
  if (bareNum) {
    const parsed = Number(bareNum[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Number(parsed.toFixed(2));
  }

  // 6. Fallback to spoken number words (e.g. "cinquenta reais")
  const wordBeforeReais =
    /\b([a-z\s]+?)\s+(?:reais|real)\b/.exec(cleaned);
  if (wordBeforeReais) {
    const parsed = parsePortugueseNumberWords(wordBeforeReais[1]);
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
}

const INCOME_KEYWORDS = [
  'recebi',
  'recebido',
  'receita',
  'salario',
  'entrou',
  'entrada',
  'rendimento',
  'dividendo',
  'dividendos',
  'bonus',
  'ferias',
  'decimo terceiro',
  '13o',
  'reembolso',
  'ganhei',
  'vendi',
  'pixr',
];

const EXPENSE_KEYWORDS = [
  'gastei',
  'paguei',
  'pago',
  'comprei',
  'compra',
  'despesa',
  'boleto',
  'fatura',
  'debito',
  'credito',
  'cartao',
  'pixd',
];

function detectTransactionType(normalized: string): TransactionType {
  // Explicit income signals win unless strong expense verb appears without income verb
  const hasIncome = INCOME_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`).test(normalized),
  );
  if (hasIncome) {
    // Handle edge case like "paguei com o salario" vs "recebi salario"
    const hasSpendVerb = /\b(gastei|paguei|comprei)\b/.test(normalized);
    if (!hasSpendVerb) {
      return 'RECEITA';
    }
  }

  const hasExpense = EXPENSE_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`).test(normalized),
  );
  if (hasExpense) {
    return 'DESPESA';
  }

  return 'DESPESA';
}

function detectPaymentAndCard(
  normalized: string,
  tipo: TransactionType,
  parcelas: number,
  formasPagamento: string[],
  cartoes: CreditCardConfig[],
): { formaPagamento: string; cartaoId?: string; cartaoNome?: string } {
  const findMethod = (candidates: string[], fallback: string) => {
    for (const cand of candidates) {
      const match = formasPagamento.find(
        (fp) => normalizeSpeechText(fp) === normalizeSpeechText(cand),
      );
      if (match) return match;
    }
    return fallback;
  };

  // Match any registered card name in speech (e.g. "nubank", "santander", "inter")
  const matchedCard = cartoes.find((c) => {
    const cardNorm = normalizeSpeechText(c.nome);
    return cardNorm.length > 0 && normalized.includes(cardNorm);
  });

  const mentionsPix = /\bpix\b|\bpixd\b|\bpixr\b/.test(normalized);
  const mentionsDebito = /\bdebito\b/.test(normalized);
  const mentionsDinheiro = /\bdinheiro\b|\bespecie\b/.test(normalized);
  const mentionsBoleto = /\bboleto\b/.test(normalized);
  const mentionsCredit =
    /\bcredito\b|\bcartao\b|\bfatura\b|\bparcelad[oa]\b/.test(normalized) ||
    parcelas > 1;

  if (mentionsCredit || (matchedCard && !mentionsPix && !mentionsDebito && !mentionsDinheiro && !mentionsBoleto)) {
    const card = matchedCard || cartoes[0];
    return {
      formaPagamento: findMethod(['CC', 'CARTAO', 'CREDITO'], 'CC'),
      cartaoId: card?.id,
      cartaoNome: card?.nome,
    };
  }

  if (mentionsPix) {
    if (tipo === 'RECEITA' || /\bpixr\b/.test(normalized)) {
      return { formaPagamento: findMethod(['PIXR', 'PIXD', 'PIX'], formasPagamento[0] || 'PIXR') };
    }
    return { formaPagamento: findMethod(['PIXD', 'PIX'], formasPagamento[0] || 'PIXD') };
  }

  if (mentionsDebito) {
    return {
      formaPagamento: findMethod(['DEBITO', 'PIXD'], formasPagamento[0] || 'PIXD'),
    };
  }

  if (mentionsDinheiro) {
    return {
      formaPagamento: findMethod(['DINHEIRO'], formasPagamento[0] || 'DINHEIRO'),
    };
  }

  if (mentionsBoleto) {
    return {
      formaPagamento: findMethod(['BOLETO'], formasPagamento[0] || 'BOLETO'),
    };
  }

  return {
    formaPagamento:
      tipo === 'RECEITA'
        ? findMethod(['PIXR', 'PIXD'], formasPagamento[0] || 'PIXR')
        : findMethod(['PIXD'], formasPagamento[0] || 'PIXD'),
  };
}

interface KeywordAlias {
  keywords: string[];
  categoryHint: string;
  subcategoryHint: string;
}

const SPEECH_CATEGORY_ALIASES: KeywordAlias[] = [
  // Receitas
  { keywords: ['salario', 'holerite', 'contracheque', 'pagamento'], categoryHint: 'RECEITAS', subcategoryHint: 'Salário' },
  { keywords: ['13o', 'decimo terceiro'], categoryHint: 'RECEITAS', subcategoryHint: '13º salário' },
  { keywords: ['ferias'], categoryHint: 'RECEITAS', subcategoryHint: 'Férias' },
  { keywords: ['bonus', 'premio', 'plr'], categoryHint: 'RECEITAS', subcategoryHint: 'Bônus' },
  { keywords: ['aluguel recebido', 'inquilino'], categoryHint: 'RECEITAS', subcategoryHint: 'Casa Aluguel' },
  { keywords: ['ticket', 'vale alimentacao', 'va', 'vr'], categoryHint: 'RECEITAS', subcategoryHint: 'Ticket Alimentação' },
  { keywords: ['dividendo', 'rendimento', 'juros'], categoryHint: 'RECEITAS', subcategoryHint: 'Investimentos' },
  { keywords: ['vendi', 'venda'], categoryHint: 'RECEITAS', subcategoryHint: 'Vendas' },

  // Alimentação
  { keywords: ['supermercado', 'mercado', 'atacadao', 'assai', 'carrefour', 'pao de acucar'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Supermercado' },
  { keywords: ['acougue', 'carne', 'churrasco'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Açougue' },
  { keywords: ['hortifruti', 'verdura', 'fruta', 'sacolao'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Hortifruti' },
  { keywords: ['padaria', 'pao', 'cafe da manha'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Padaria' },
  { keywords: ['feira'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Feira' },
  { keywords: ['mercearia'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Mercearia' },
  { keywords: ['lanchonete', 'lanche', 'hamburguer', 'pastel', 'ifood'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Lanchonete' },
  { keywords: ['restaurante', 'almoco', 'jantar', 'comida'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Restaurante' },
  { keywords: ['pizza', 'pizzaria'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Pizzaria' },
  { keywords: ['sorvete', 'sorveteria', 'acai'], categoryHint: 'ALIMENTAÇÃO', subcategoryHint: 'Sorveteria' },

  // Higiene / Farmácia
  { keywords: ['farmacia', 'drogaria', 'droga raia', 'pague menos'], categoryHint: 'HIGIENE', subcategoryHint: 'Farmácia Higiene' },
  { keywords: ['perfume', 'perfumaria', 'cosmetico'], categoryHint: 'HIGIENE', subcategoryHint: 'Perfumaria' },
  { keywords: ['barbearia', 'barbeiro', 'salao', 'cabelo', 'corte'], categoryHint: 'HIGIENE', subcategoryHint: 'Barbearia/Salão' },

  // Saúde
  { keywords: ['remedio', 'medicamento', 'medicamentos'], categoryHint: 'SAÚDE', subcategoryHint: 'Medicamentos' },
  { keywords: ['consulta', 'medico', 'clinica'], categoryHint: 'SAÚDE', subcategoryHint: 'Consultas' },
  { keywords: ['exame', 'exames', 'laboratorio'], categoryHint: 'SAÚDE', subcategoryHint: 'Exames' },
  { keywords: ['plano de saude', 'unimed', 'convenio'], categoryHint: 'SAÚDE', subcategoryHint: 'Plano de Saúde' },
  { keywords: ['dentista', 'odonto', 'odontologia'], categoryHint: 'SAÚDE', subcategoryHint: 'Odontologia' },

  // Transporte
  { keywords: ['combustivel', 'gasolina', 'etanol', 'alcool', 'diesel', 'posto'], categoryHint: 'TRANSPORTE', subcategoryHint: 'Combustível' },
  { keywords: ['uber', '99', 'taxi', 'aplicativo'], categoryHint: 'TRANSPORTE', subcategoryHint: 'Aplicativo' },
  { keywords: ['onibus', 'metro', 'trem', 'passagem', 'bilhete unico'], categoryHint: 'TRANSPORTE', subcategoryHint: 'Transporte público' },
  { keywords: ['estacionamento', 'zona azul'], categoryHint: 'TRANSPORTE', subcategoryHint: 'Estacionamento' },
  { keywords: ['mecanico', 'oficina', 'manutencao', 'troca de oleo'], categoryHint: 'TRANSPORTE', subcategoryHint: 'Manutenção' },
  { keywords: ['ipva', 'pedagio'], categoryHint: 'TRANSPORTE', subcategoryHint: 'IPVA/Seguro' },

  // Casa
  { keywords: ['aluguel'], categoryHint: 'CASA', subcategoryHint: 'Aluguel' },
  { keywords: ['condominio'], categoryHint: 'CASA', subcategoryHint: 'Condomínio' },
  { keywords: ['agua', 'sabesp', 'sanepar'], categoryHint: 'CASA', subcategoryHint: 'Conta de Água' },
  { keywords: ['luz', 'energia', 'eletrica', 'enel', 'cpfl'], categoryHint: 'CASA', subcategoryHint: 'Conta de Luz' },
  { keywords: ['gas', 'botijao'], categoryHint: 'CASA', subcategoryHint: 'Conta de Gás' },
  { keywords: ['internet', 'wifi', 'fibra'], categoryHint: 'CASA', subcategoryHint: 'Conta de Internet' },
  { keywords: ['celular', 'telefone', 'recarga'], categoryHint: 'CASA', subcategoryHint: 'Conta de Celular' },
  { keywords: ['iptu'], categoryHint: 'CASA', subcategoryHint: 'IPTU' },
  { keywords: ['diarista', 'faxina'], categoryHint: 'CASA', subcategoryHint: 'Diarista' },
  { keywords: ['racao', 'pet', 'veterinario', 'cachorro', 'gato'], categoryHint: 'CASA', subcategoryHint: 'Animais(ração, remédios)' },
  { keywords: ['geladeira', 'fogao', 'eletrodomestico', 'tv', 'maquina'], categoryHint: 'CASA', subcategoryHint: 'Eletrodomésticos' },

  // Lazer
  { keywords: ['netflix', 'spotify', 'amazon prime', 'disney', 'streaming', 'youtube'], categoryHint: 'LAZER', subcategoryHint: 'Streaming' },
  { keywords: ['cinema', 'teatro', 'ingresso', 'show'], categoryHint: 'LAZER', subcategoryHint: 'Cinema/Teatro' },
  { keywords: ['viagem', 'viagens', 'hotel', 'hospedagem', 'passagem aerea'], categoryHint: 'LAZER', subcategoryHint: 'Viagens' },
  { keywords: ['jogo', 'jogos', 'playstation', 'xbox', 'steam'], categoryHint: 'LAZER', subcategoryHint: 'Jogos' },

  // Educação
  { keywords: ['escola', 'faculdade', 'mensalidade'], categoryHint: 'EDUCAÇÃO', subcategoryHint: 'Mensalidade' },
  { keywords: ['curso', 'cursos'], categoryHint: 'EDUCAÇÃO', subcategoryHint: 'Cursos' },
  { keywords: ['livro', 'livros', 'livraria'], categoryHint: 'EDUCAÇÃO', subcategoryHint: 'Livros' },

  // Celebrações / Família / Outros
  { keywords: ['dizimo', 'doacao', 'igreja', 'oferta'], categoryHint: 'CELEBRAÇÕES', subcategoryHint: 'Dízimos e doações' },
  { keywords: ['presente', 'aniversario'], categoryHint: 'CELEBRAÇÕES', subcategoryHint: 'Presentes' },
];

function hasWholeTerm(normalizedText: string, term: string): boolean {
  const cleanTerm = term.trim();
  if (!cleanTerm) return false;
  const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`).test(normalizedText);
}

function matchCategoryAndSubcategory(
  normalized: string,
  tipo: TransactionType,
  categories: CategoryConfig[],
): { categoria: string; descricao: string } {
  const pool = categories.filter((c) => c.tipo === tipo);
  const fallbackPool = pool.length > 0 ? pool : categories;
  const defaultCat = fallbackPool[0];

  if (!defaultCat) {
    return { categoria: 'ALIMENTAÇÃO', descricao: 'Outros' };
  }

  // 1. Direct whole-word match against user's existing subcategories & categories
  let bestScore = 0;
  let bestCat = defaultCat.nome;
  let bestSub = defaultCat.subcategorias[0] || 'Outros';

  for (const cat of fallbackPool) {
    const catNorm = normalizeSpeechText(cat.nome);
    if (catNorm && hasWholeTerm(normalized, catNorm)) {
      const score = 20 + catNorm.length;
      if (score > bestScore) {
        bestScore = score;
        bestCat = cat.nome;
        bestSub = cat.subcategorias[0] || 'Outros';
      }
    }

    for (const sub of cat.subcategorias) {
      const subNorm = normalizeSpeechText(sub);
      if (!subNorm || subNorm === 'outros') continue;
      // Split composite subcategory names like "Cinema/Teatro" or "Farmácia Higiene"
      const parts = subNorm
        .split(/[\/(),]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 3);
      for (const part of [subNorm, ...parts]) {
        if (hasWholeTerm(normalized, part)) {
          const score = 40 + part.length;
          if (score > bestScore) {
            bestScore = score;
            bestCat = cat.nome;
            bestSub = sub;
          }
        }
      }
    }
  }

  if (bestScore >= 40) {
    return { categoria: bestCat, descricao: bestSub };
  }

  // 2. Semantic aliases matched against user's existing categories/subcategories
  for (const alias of SPEECH_CATEGORY_ALIASES) {
    const matchedKw = alias.keywords.find((kw) => hasWholeTerm(normalized, kw));
    if (!matchedKw) continue;

    const targetCat = fallbackPool.find(
      (c) => normalizeSpeechText(c.nome) === normalizeSpeechText(alias.categoryHint),
    );
    if (targetCat) {
      const targetSub =
        targetCat.subcategorias.find(
          (s) => normalizeSpeechText(s) === normalizeSpeechText(alias.subcategoryHint),
        ) ||
        targetCat.subcategorias[0] ||
        'Outros';
      return { categoria: targetCat.nome, descricao: targetSub };
    }
  }

  return { categoria: bestCat, descricao: bestSub };
}

function detectTitular(normalized: string, titulares: string[]): string | undefined {
  for (const t of titulares) {
    const tNorm = normalizeSpeechText(t);
    if (tNorm && new RegExp(`\\b${tNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalized)) {
      return t;
    }
  }
  return undefined;
}

function buildVoiceObservation(rawTranscript: string): string {
  const trimmed = rawTranscript.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (trimmed.length <= 80) {
    return `Voz: "${trimmed}"`;
  }
  return `Voz: "${trimmed.slice(0, 77)}..."`;
}

export function parseVoiceTransaction(
  transcript: string,
  context: VoiceParseContext,
): ParsedVoiceTransaction {
  const cleanTranscript = transcript.trim();
  const normalized = normalizeSpeechText(cleanTranscript);

  const tipo = detectTransactionType(normalized);
  const valor = extractAmountFromSpeech(cleanTranscript);
  const rawParcelas = extractInstallmentsFromSpeech(normalized);
  const payment = detectPaymentAndCard(
    normalized,
    tipo,
    rawParcelas,
    context.formasPagamento,
    context.cartoes,
  );
  const isCC = payment.formaPagamento.toUpperCase() === 'CC';
  const parcelas = isCC ? rawParcelas : 1;
  const { categoria, descricao } = matchCategoryAndSubcategory(
    normalized,
    tipo,
    context.categories,
  );
  const titular = detectTitular(normalized, context.titulares);
  const obs = buildVoiceObservation(cleanTranscript);

  return {
    transcript: cleanTranscript,
    tipo,
    valor,
    formaPagamento: payment.formaPagamento,
    cartaoId: payment.cartaoId,
    cartaoNome: payment.cartaoNome,
    parcelas,
    categoria,
    descricao,
    titular,
    obs,
  };
}
