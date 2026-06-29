export type TranslationProvider = "openai" | "deepl" | "google";

export type GlossaryEntry = {
  id: string;
  source: string;
  target: string;
  language: string;
};

export type MatchedTerm = {
  source: string;
  target: string;
  count: number;
};

export type TranslationRequest = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  orgId: string;
  meetingId?: string;
  userId?: string;
  glossary?: GlossaryEntry[];
  matchedTerms?: MatchedTerm[];
};

export type TranslationResult = {
  translatedText: string;
  matchedTerms: MatchedTerm[];
  cached: boolean;
  latencyMs: number;
  provider: TranslationProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type TranslateTextParams = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  meetingId: string;
  userId?: string;
};
