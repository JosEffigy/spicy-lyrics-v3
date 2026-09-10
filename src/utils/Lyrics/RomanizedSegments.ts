// Normalize a complete lyric line, not individual timing fragments. A pending
// separator belongs to the next visible fragment; empty beats cannot duplicate it.
export function normalizeRomanizedWhitespace(segments: string[]): string[] {
  let seenText = false;
  let pendingSpace = false;
  return segments.map(text => {
    let output = "";
    for (const char of text) {
      if (/\s/u.test(char)) {
        if (seenText) pendingSpace = true;
      } else {
        if (pendingSpace) output += " ";
        output += char;
        pendingSpace = false;
        seenText = true;
      }
    }
    return output;
  });
}

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
    TransliteratedText: segment.TransliteratedText?.replace(/\s+/gu, " ").trim(),
    IsPartOfWord: segment.RomanizedIsPartOfWord,
  }));
}
