import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CreditCard,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
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
import {
  mergeSpeechSegments,
  parseVoiceTransaction,
  type ParsedVoiceTransaction,
} from '../utils/voiceParser';
import { CurrencyInput } from './CurrencyInput';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

interface TransactionModalProps {
  isOpen: boolean;
  initialTransaction?: Transaction | null;
  autoStartVoice?: boolean;
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
  autoStartVoice = false,
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

  // Voice entry states
  const [isSpeechSupported] = useState<boolean>(
    () => getSpeechRecognitionCtor() !== null,
  );
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [lastParsedVoice, setLastParsedVoice] =
    useState<ParsedVoiceTransaction | null>(null);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState('');
  const [voiceErrorMsg, setVoiceErrorMsg] = useState('');
  const [showPhraseFallback, setShowPhraseFallback] = useState(
    () => getSpeechRecognitionCtor() === null,
  );
  const [manualPhrase, setManualPhrase] = useState('');

  const prevOpenRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const manualPhraseInputRef = useRef<HTMLInputElement | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const basePhraseRef = useRef('');
  const sessionFinalRef = useRef('');
  const interimRef = useRef('');
  const manualPhraseRef = useRef('');

  const filteredCategories = categories.filter((c) => c.tipo === tipo);
  const selectedCatObj =
    filteredCategories.find((c) => c.nome === categoria) || filteredCategories[0];
  const subcategories = selectedCatObj?.subcategorias || ['Outros'];

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const abortVoiceRecognition = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearRestartTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    sessionFinalRef.current = '';
    interimRef.current = '';
    setIsListening(false);
    setInterimTranscript('');
  }, [clearRestartTimer]);

  const applyVoiceTranscript = useCallback(
    (rawPhrase: string) => {
      const cleaned = rawPhrase.trim();
      if (!cleaned) {
        setVoiceErrorMsg('Fale ou digite uma frase com o lançamento para interpretar.');
        return;
      }

      const parsed = parseVoiceTransaction(cleaned, {
        categories,
        formasPagamento,
        cartoes,
        titulares,
      });

      setVoiceTranscript(parsed.transcript);
      setLastParsedVoice(parsed);
      setVoiceErrorMsg('');
      setVoiceStatusMsg(
        parsed.valor !== null
          ? 'Campos preenchidos pela voz. Revise abaixo antes de salvar.'
          : 'Frase transcrita! Informe ou ajuste o valor (R$) abaixo antes de salvar.',
      );

      setTipo(parsed.tipo);
      setCategoria(parsed.categoria);
      setDescricao(parsed.descricao);
      if (parsed.valor !== null) {
        setValor(parsed.valor);
      }
      setFormaPagamento(parsed.formaPagamento);
      if (parsed.cartaoId) {
        setSelectedCardId(parsed.cartaoId);
      }
      setParcelas(parsed.parcelas);
      setManualStartOffset(null);
      if (parsed.titular) {
        setTitular(parsed.titular);
      }
      if (parsed.obs) {
        setObs(parsed.obs);
      }
      setErrorMsg('');
    },
    [categories, formasPagamento, cartoes, titulares],
  );

  const launchRecognitionSession = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      setShowPhraseFallback(true);
      setVoiceErrorMsg(
        'Seu navegador não suporta reconhecimento de voz nativo. Use o campo abaixo para digitar ou ditar pelo teclado.',
      );
      setTimeout(() => manualPhraseInputRef.current?.focus(), 50);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      sessionFinalRef.current = '';
      interimRef.current = '';

      recognition.onresult = (event) => {
        let sessionFinal = '';
        let sessionInterim = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const text = (res[0]?.transcript || '').trim();
          if (!text) continue;
          if (res.isFinal) {
            sessionFinal = mergeSpeechSegments(sessionFinal, text);
          } else {
            sessionInterim = mergeSpeechSegments(sessionInterim, text);
          }
        }

        sessionFinalRef.current = sessionFinal;
        interimRef.current = sessionInterim;

        const accumulatedPhrase = mergeSpeechSegments(
          basePhraseRef.current,
          sessionFinal,
        );
        manualPhraseRef.current = accumulatedPhrase;
        setManualPhrase(accumulatedPhrase);
        setInterimTranscript(sessionInterim);
      };

      recognition.onerror = (event) => {
        const code = event?.error || 'unknown';
        if (code === 'no-speech' && shouldKeepListeningRef.current) {
          // Keep recording active on temporary silence; onend will restart if needed
          return;
        }
        if (code === 'aborted' && !shouldKeepListeningRef.current) {
          return;
        }

        shouldKeepListeningRef.current = false;
        clearRestartTimer();
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;

        const committed = mergeSpeechSegments(
          basePhraseRef.current,
          sessionFinalRef.current,
          interimRef.current,
        );
        if (committed) {
          basePhraseRef.current = committed;
          manualPhraseRef.current = committed;
          setManualPhrase(committed);
        }
        sessionFinalRef.current = '';
        interimRef.current = '';

        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setVoiceErrorMsg(
            'Permissão de microfone bloqueada. Libere o microfone no navegador ou use o campo manual abaixo.',
          );
          setShowPhraseFallback(true);
        } else {
          setVoiceErrorMsg(
            'Não foi possível continuar a captura do áudio. Revise a frase abaixo ou tente novamente.',
          );
          setShowPhraseFallback(true);
        }
        setVoiceStatusMsg('');
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        const committed = mergeSpeechSegments(
          basePhraseRef.current,
          sessionFinalRef.current,
        );
        basePhraseRef.current = committed;
        sessionFinalRef.current = '';
        manualPhraseRef.current = committed;
        setManualPhrase(committed);

        if (shouldKeepListeningRef.current) {
          interimRef.current = '';
          setInterimTranscript('');
          clearRestartTimer();
          restartTimerRef.current = window.setTimeout(() => {
            if (shouldKeepListeningRef.current) {
              launchRecognitionSession();
            }
          }, 120);
        } else {
          setIsListening(false);
          interimRef.current = '';
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      setShowPhraseFallback(true);
      setVoiceErrorMsg(
        'Não foi possível iniciar o microfone neste navegador. Use o campo de frase abaixo.',
      );
    }
  }, [clearRestartTimer]);

  const startVoiceRecognition = useCallback(
    (initialPhraseOverride?: string) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setShowPhraseFallback(true);
        setVoiceErrorMsg(
          'Seu navegador não suporta reconhecimento de voz nativo. Use o campo abaixo para digitar ou ditar pelo teclado.',
        );
        setTimeout(() => manualPhraseInputRef.current?.focus(), 50);
        return;
      }

      clearRestartTimer();
      const seedPhrase = (
        initialPhraseOverride !== undefined
          ? initialPhraseOverride
          : manualPhraseRef.current
      ).trim();
      basePhraseRef.current = seedPhrase;
      manualPhraseRef.current = seedPhrase;
      setManualPhrase(seedPhrase);
      if (initialPhraseOverride === '') {
        setVoiceTranscript('');
        setLastParsedVoice(null);
      }
      sessionFinalRef.current = '';
      interimRef.current = '';
      shouldKeepListeningRef.current = true;
      setShowPhraseFallback(true);
      setVoiceErrorMsg('');
      setVoiceStatusMsg(
        'Ouvindo... fale todos os dados e clique em "Parar e Interpretar" para concluir.',
      );
      setInterimTranscript('');
      launchRecognitionSession();
    },
    [clearRestartTimer, launchRecognitionSession],
  );

  const stopAndInterpretVoice = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearRestartTimer();

    const accumulatedPhrase = mergeSpeechSegments(
      basePhraseRef.current,
      sessionFinalRef.current,
      interimRef.current,
    );

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }

    basePhraseRef.current = accumulatedPhrase;
    sessionFinalRef.current = '';
    interimRef.current = '';
    manualPhraseRef.current = accumulatedPhrase;
    setIsListening(false);
    setInterimTranscript('');
    setManualPhrase(accumulatedPhrase);

    if (!accumulatedPhrase) {
      setVoiceStatusMsg('');
      setVoiceErrorMsg(
        'Nenhuma fala foi capturada. Clique em "Falar" novamente ou digite a frase abaixo.',
      );
      return;
    }

    applyVoiceTranscript(accumulatedPhrase);
  }, [applyVoiceTranscript, clearRestartTimer]);

  const handleClearPhrase = useCallback(() => {
    basePhraseRef.current = '';
    sessionFinalRef.current = '';
    interimRef.current = '';
    manualPhraseRef.current = '';
    setManualPhrase('');
    setInterimTranscript('');
    setVoiceTranscript('');
    setLastParsedVoice(null);
    setVoiceErrorMsg('');

    if (shouldKeepListeningRef.current) {
      clearRestartTimer();
      setVoiceStatusMsg(
        'Frase limpa. Continue falando e clique em "Parar e Interpretar" ao concluir.',
      );
      launchRecognitionSession();
    } else {
      setVoiceStatusMsg('');
      setTimeout(() => manualPhraseInputRef.current?.focus(), 30);
    }
  }, [clearRestartTimer, launchRecognitionSession]);

  const handleClearVoice = () => {
    abortVoiceRecognition();
    basePhraseRef.current = '';
    manualPhraseRef.current = '';
    setVoiceTranscript('');
    setLastParsedVoice(null);
    setVoiceStatusMsg('');
    setVoiceErrorMsg('');
    setManualPhrase('');

    if (!initialTransaction) {
      const defaultTipo: TransactionType = 'DESPESA';
      const defaultCat =
        categories.find((c) => c.tipo === defaultTipo) || categories[0];
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
      setManualStartOffset(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      abortVoiceRecognition();
    }
  }, [isOpen, abortVoiceRecognition]);

  useEffect(() => {
    return () => {
      abortVoiceRecognition();
    };
  }, [abortVoiceRecognition]);

  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (!justOpened) return;
    abortVoiceRecognition();
    basePhraseRef.current = '';
    manualPhraseRef.current = '';
    setErrorMsg('');
    setShowQuickCardForm(false);
    setQuickCardName('');
    setQuickCardDueDay('10');
    setQuickCardError('');
    setManualStartOffset(null);
    setVoiceTranscript('');
    setLastParsedVoice(null);
    setVoiceStatusMsg('');
    setVoiceErrorMsg('');
    setManualPhrase('');
    setInterimTranscript('');

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

      if (autoStartVoice) {
        if (getSpeechRecognitionCtor()) {
          setTimeout(() => startVoiceRecognition(''), 80);
        } else {
          setShowPhraseFallback(true);
          setVoiceStatusMsg(
            'Navegador sem suporte à API de voz nativa: digite ou dite pelo teclado abaixo.',
          );
          setTimeout(() => manualPhraseInputRef.current?.focus(), 80);
        }
      }
    }
  }, [
    isOpen,
    initialTransaction,
    autoStartVoice,
    activeAno,
    activeMes,
    categories,
    formasPagamento,
    titulares,
    cartoes,
    abortVoiceRecognition,
    startVoiceRecognition,
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
    if (!isCreditCard || initialTransaction) {
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
          {!initialTransaction && (
            <div
              data-testid="voice-entry-panel"
              className="rounded-xl border-[1.5px] border-[var(--card-gold-border)] bg-[var(--card-gold-bg)] p-3.5 sm:p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mic
                    className={`w-4 h-4 shrink-0 ${
                      isListening
                        ? 'text-[var(--semantic-expense)] animate-pulse'
                        : 'text-[var(--accent-gold)]'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)] block">
                      Lançamento por Voz
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] block truncate">
                      Ex.: &quot;Gastei 120 e 50 na farmácia no Nubank em 3x&quot;
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      isListening
                        ? stopAndInterpretVoice()
                        : startVoiceRecognition()
                    }
                    aria-pressed={isListening}
                    aria-label={
                      isListening
                        ? 'Parar e interpretar ditado por voz'
                        : 'Falar lançamento'
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      isListening
                        ? 'bg-[var(--semantic-expense)] border-[var(--semantic-expense)] text-white animate-pulse'
                        : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] border-transparent text-[var(--accent-primary-text)]'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Parar e Interpretar</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Falar</span>
                      </>
                    )}
                  </button>

                  {!isListening && (
                    <button
                      type="button"
                      onClick={() => setShowPhraseFallback((v) => !v)}
                      aria-expanded={showPhraseFallback}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-xs font-medium text-[var(--text-secondary)] transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {showPhraseFallback ? 'Ocultar texto' : 'Digitar frase'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {isListening && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="voice-listening-banner"
                  className="rounded-lg border border-[var(--semantic-expense)]/40 bg-[var(--semantic-expense-bg)] px-3 py-2 text-xs text-[var(--text-primary)] space-y-1"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--semantic-expense)] animate-ping shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Ouvindo... fale todos os dados e clique para concluir
                    </span>
                  </div>
                  {interimTranscript && (
                    <p className="text-[11px] text-[var(--text-secondary)] pl-4 italic break-words">
                      Em andamento: &ldquo;{interimTranscript}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {!isSpeechSupported && (
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Reconhecimento de voz direto não disponível neste navegador. Você pode ditar pelo microfone do teclado ou digitar a frase abaixo para preencher automaticamente.
                </p>
              )}

              {voiceErrorMsg && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[var(--semantic-expense)]"
                >
                  {voiceErrorMsg}
                </p>
              )}

              {voiceStatusMsg && !isListening && !voiceErrorMsg && (
                <p
                  role="status"
                  className="text-xs font-medium text-[var(--semantic-income)]"
                >
                  {voiceStatusMsg}
                </p>
              )}

              {(showPhraseFallback || isListening || Boolean(manualPhrase)) && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="voice-phrase-input" className="sr-only">
                      Frase do lançamento por voz
                    </label>
                    <input
                      ref={manualPhraseInputRef}
                      id="voice-phrase-input"
                      type="text"
                      readOnly={isListening}
                      value={manualPhrase}
                      onChange={(e) => {
                        const val = e.target.value;
                        manualPhraseRef.current = val;
                        basePhraseRef.current = val;
                        setManualPhrase(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isListening) {
                            stopAndInterpretVoice();
                          } else {
                            applyVoiceTranscript(manualPhrase);
                          }
                        }
                      }}
                      placeholder="Ex.: Recebi 5000 de salário no pix ou Paguei 120 e 50 no mercado Nubank 2x"
                      className="flex-1 bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-3 py-1.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)]"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          isListening
                            ? stopAndInterpretVoice()
                            : applyVoiceTranscript(manualPhrase)
                        }
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-md border-[1.5px] border-[var(--accent-blue-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-xs font-semibold text-[var(--accent-blue)] whitespace-nowrap cursor-pointer"
                      >
                        Interpretar frase
                      </button>
                      <button
                        type="button"
                        onClick={handleClearPhrase}
                        className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:bg-[var(--semantic-expense-bg)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--semantic-expense)] whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Limpar frase
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {voiceTranscript && (
                <div
                  data-testid="voice-transcript-display"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] block">
                        Frase transcrita
                      </span>
                      <p className="text-xs sm:text-sm font-medium text-[var(--text-primary)] break-words">
                        &ldquo;{voiceTranscript}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (isSpeechSupported) {
                            startVoiceRecognition('');
                          } else {
                            setShowPhraseFallback(true);
                            manualPhraseInputRef.current?.focus();
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" aria-hidden="true" />
                        <span>Tentar novamente</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearVoice}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:bg-[var(--semantic-expense-bg)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--semantic-expense)] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>Limpar</span>
                      </button>
                    </div>
                  </div>

                  {lastParsedVoice && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono-nums text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] font-semibold">
                        {lastParsedVoice.tipo === 'RECEITA' ? '+ RECEITA' : '- DESPESA'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] font-semibold">
                        {lastParsedVoice.valor !== null
                          ? formatBRL(lastParsedVoice.valor)
                          : 'Valor não detectado'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                        {lastParsedVoice.formaPagamento}
                        {lastParsedVoice.cartaoNome ? ` · ${lastParsedVoice.cartaoNome}` : ''}
                        {lastParsedVoice.parcelas > 1 ? ` · ${lastParsedVoice.parcelas}x` : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                        {lastParsedVoice.categoria} / {lastParsedVoice.descricao}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

              {!initialTransaction && (
                <div className="space-y-3 pt-1">
                  <div
                    className={`grid grid-cols-1 ${
                      parcelas > 1 ? 'sm:grid-cols-2' : ''
                    } gap-3`}
                  >
                    {parcelas > 1 && (
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
                    )}

                    <div>
                      <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        {parcelas > 1
                          ? '1ª Parcela na fatura de:'
                          : 'Competência da fatura:'}
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

                  {selectedCard && (
                    <p
                      data-testid="cc-due-rule-hint"
                      className="text-[11px] font-medium text-[var(--text-secondary)]"
                    >
                      {autoStartInfo.isNextMonth
                        ? `Compra após o vencimento (dia ${String(selectedCard.diaVencimento).padStart(2, '0')}): competência direcionada automaticamente para ${nextMonthLabel}.`
                        : `Compra até o vencimento (dia ${String(selectedCard.diaVencimento).padStart(2, '0')}): competência inicial em ${sameMonthLabel}.`}
                      {manualStartOffset !== null &&
                        manualStartOffset !== (autoStartInfo.isNextMonth ? 1 : 0) &&
                        ' (Ajustado manualmente)'}
                    </p>
                  )}

                  {/* Installment / Invoice Competence Preview */}
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
                          {parcelas > 1
                            ? `Prévia das ${parcelas} parcelas`
                            : 'Prévia do lançamento na fatura'}
                          {selectedCard ? ` · ${selectedCard.nome}` : ''}
                        </span>
                        <span className="font-mono-nums font-bold text-[var(--text-primary)]">
                          {parcelas > 1
                            ? `${parcelas}x de ${formatBRL(installmentPlan.valorParcelaBase)} · Total ${formatBRL(installmentPlan.totalValor)}`
                            : formatBRL(installmentPlan.totalValor)}
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
                        {installmentPlan.items.map((item, idx) => (
                          <li
                            key={item.parcelaAtual ?? idx}
                            className="py-1.5 flex items-center justify-between gap-2 text-[var(--text-secondary)]"
                          >
                            <span>
                              <strong className="text-[var(--text-primary)]">
                                {item.parcelaAtual && item.totalParcelas
                                  ? `${item.parcelaAtual}/${item.totalParcelas}`
                                  : 'À vista (1x)'}
                              </strong>{' '}
                              · {item.data} (Fatura {MONTH_ABBR[item.mes - 1]}/
                              {item.ano})
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
