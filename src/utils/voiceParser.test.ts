import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CREDIT_CARDS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_TITULARES,
} from '../data/defaults';
import {
  extractAmountFromSpeech,
  extractInstallmentsFromSpeech,
  mergeSpeechSegments,
  parseVoiceTransaction,
} from './voiceParser';

const BASE_CTX = {
  categories: DEFAULT_CATEGORIES,
  formasPagamento: DEFAULT_PAYMENT_METHODS,
  cartoes: DEFAULT_CREDIT_CARDS,
  titulares: DEFAULT_TITULARES,
};

test('extractAmountFromSpeech handles integers, reais e centavos, R$ formats, and spoken words', () => {
  assert.equal(extractAmountFromSpeech('Gastei 50 no lanche'), 50);
  assert.equal(extractAmountFromSpeech('Paguei 50 reais no mercado'), 50);
  assert.equal(extractAmountFromSpeech('Compra de 120 e 50 na farmácia'), 120.5);
  assert.equal(extractAmountFromSpeech('Gastei 120 reais e 50 centavos'), 120.5);
  assert.equal(extractAmountFromSpeech('Recebi R$ 85,00 de reembolso'), 85);
  assert.equal(extractAmountFromSpeech('Paguei R$ 1.250,75 em 3x no cartão'), 1250.75);
  assert.equal(extractAmountFromSpeech('Gastei cinquenta reais no uber'), 50);
});

test('extractInstallmentsFromSpeech recognizes 3x, 3 vezes, parcelado em 6, and ignores out-of-range', () => {
  assert.equal(extractInstallmentsFromSpeech('compra em 3x no nubank'), 3);
  assert.equal(extractInstallmentsFromSpeech('parcelado em 6 vezes'), 6);
  assert.equal(extractInstallmentsFromSpeech('em 12 parcelas'), 12);
  assert.equal(extractInstallmentsFromSpeech('em tres vezes'), 3);
  assert.equal(extractInstallmentsFromSpeech('compra a vista no pix'), 1);
});

test('parseVoiceTransaction detects RECEITA with salario and PIXR', () => {
  const result = parseVoiceTransaction(
    'Recebi 5400 reais de salário no pix',
    BASE_CTX,
  );
  assert.equal(result.tipo, 'RECEITA');
  assert.equal(result.valor, 5400);
  assert.equal(result.formaPagamento, 'PIXR');
  assert.equal(result.categoria, 'RECEITAS');
  assert.equal(result.descricao, 'Salário');
  assert.equal(result.parcelas, 1);
});

test('parseVoiceTransaction detects DESPESA on credit card, card name, installments, and category', () => {
  const result = parseVoiceTransaction(
    'Comprei eletrodoméstico por 1800 reais no cartão Santander em 6x para familia',
    BASE_CTX,
  );
  assert.equal(result.tipo, 'DESPESA');
  assert.equal(result.valor, 1800);
  assert.equal(result.formaPagamento, 'CC');
  assert.equal(result.cartaoId, 'cc_santander');
  assert.equal(result.cartaoNome, 'Santander');
  assert.equal(result.parcelas, 6);
  assert.equal(result.categoria, 'CASA');
  assert.equal(result.descricao, 'Eletrodomésticos');
  assert.equal(result.titular, 'familia');
  assert.ok(result.obs.includes('Santander'));
});

test('parseVoiceTransaction matches Nubank, farmácia, combustível, and safe defaults', () => {
  const pharm = parseVoiceTransaction(
    'Gastei 85,40 na farmácia no Nubank em 2 vezes',
    BASE_CTX,
  );
  assert.equal(pharm.tipo, 'DESPESA');
  assert.equal(pharm.valor, 85.4);
  assert.equal(pharm.formaPagamento, 'CC');
  assert.equal(pharm.cartaoId, 'cc_nubank');
  assert.equal(pharm.parcelas, 2);
  assert.equal(pharm.categoria, 'HIGIENE');
  assert.equal(pharm.descricao, 'Farmácia Higiene');

  const fuel = parseVoiceTransaction(
    'Paguei 220 reais de combustível no débito',
    BASE_CTX,
  );
  assert.equal(fuel.tipo, 'DESPESA');
  assert.equal(fuel.valor, 220);
  assert.equal(fuel.formaPagamento, 'PIXD');
  assert.equal(fuel.categoria, 'TRANSPORTE');
  assert.equal(fuel.descricao, 'Combustível');

  const fallback = parseVoiceTransaction('Gastei 42 reais', BASE_CTX);
  assert.equal(fallback.tipo, 'DESPESA');
  assert.equal(fallback.valor, 42);
  assert.equal(fallback.categoria, 'ALIMENTAÇÃO');
  assert.equal(fallback.descricao, 'Supermercado');
});

test('mergeSpeechSegments accumulates multi-pause segments into a single continuous phrase', () => {
  const step1 = mergeSpeechSegments('', 'Comprei eletrodoméstico');
  const step2 = mergeSpeechSegments(step1, '  por 1800 reais  ');
  const step3 = mergeSpeechSegments(step2, 'no cartão Santander', 'em 6 vezes');
  assert.equal(
    step3,
    'Comprei eletrodoméstico por 1800 reais no cartão Santander em 6 vezes',
  );

  const parsed = parseVoiceTransaction(step3, BASE_CTX);
  assert.equal(parsed.tipo, 'DESPESA');
  assert.equal(parsed.valor, 1800);
  assert.equal(parsed.formaPagamento, 'CC');
  assert.equal(parsed.cartaoId, 'cc_santander');
  assert.equal(parsed.parcelas, 6);
  assert.equal(parsed.categoria, 'CASA');
  assert.equal(parsed.descricao, 'Eletrodomésticos');
});

