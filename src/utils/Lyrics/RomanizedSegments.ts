export function romanizedSegments<T extends {
  TransliteratedText?: string;
  IsPartOfWord?: boolean;
  RomanizedIsPartOfWord?: boolean;
}>(segments: T[], enabled: boolean): T[] {
  if (!enabled) return segments;
  return segments.map(segment => segment.RomanizedIsPartOfWord === undefined ? segment : ({
    ...segment,
    // The renderer supplies boundary gaps through its word-group CSS. Keep
    // internal spaces, but don't render the same boundary gap twice.
    TransliteratedText: segment.TransliteratedText?.trim(),
    IsPartOfWord: segment.RomanizedIsPartOfWord,
  }));
}
