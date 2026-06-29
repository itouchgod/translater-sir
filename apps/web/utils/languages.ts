export type SupportedLanguage = "zh" | "en" | "ja" | "ko" | "es" | "fr" | "de";

export type SupportedLanguagePair = {
  source: SupportedLanguage;
  target: SupportedLanguage;
  label: string;
};

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
  zh: "中文",
  en: "英文",
  ja: "日文",
  ko: "韩文",
  es: "西班牙文",
  fr: "法文",
  de: "德文",
};

export const SUPPORTED_LANGUAGE_PAIRS: SupportedLanguagePair[] = [
  { source: "zh", target: "en", label: "中文 -> 英文" },
  { source: "en", target: "zh", label: "英文 -> 中文" },
  { source: "zh", target: "ja", label: "中文 -> 日文" },
  { source: "ja", target: "zh", label: "日文 -> 中文" },
  { source: "en", target: "ja", label: "英文 -> 日文" },
  { source: "ja", target: "en", label: "日文 -> 英文" },
  { source: "zh", target: "ko", label: "中文 -> 韩文" },
  { source: "ko", target: "zh", label: "韩文 -> 中文" },
  { source: "en", target: "es", label: "英文 -> 西班牙文" },
  { source: "es", target: "en", label: "西班牙文 -> 英文" },
  { source: "en", target: "fr", label: "英文 -> 法文" },
  { source: "fr", target: "en", label: "法文 -> 英文" },
  { source: "en", target: "de", label: "英文 -> 德文" },
  { source: "de", target: "en", label: "德文 -> 英文" },
];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value in SUPPORTED_LANGUAGES;
}

export function isSupportedLanguagePair(source: string, target: string) {
  return SUPPORTED_LANGUAGE_PAIRS.some((pair) => pair.source === source && pair.target === target);
}

export function getLanguageLabel(language: string) {
  return isSupportedLanguage(language) ? SUPPORTED_LANGUAGES[language] : language;
}
