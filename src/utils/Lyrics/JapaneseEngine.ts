import { contextualReadings, hasJapanese, romanizeKana, type ReadingToken } from "./JapaneseContext.ts";
import { reconcileJapaneseSpacing } from "./JapaneseWordSpacing.ts";
import { normalizeRomanizedWhitespace } from "./RomanizedSegments.ts";
import { completeSourceRomaji } from "./SourceRomaji.ts";

// Cache phrase analysis, not timing-specific output. Repeated choruses and
// different karaoke segmentations can share the same dictionary work.
export function createJapaneseEngine(tokenize: (text: string) => Promise<ReadingToken[]>,
  capacity = 256) {
  const cache = new Map<string, Promise<ReadingToken[]>>();
  const analyze = (text: string) => {
    let pending = cache.get(text);
    if (pending) {
      cache.delete(text);
      cache.set(text, pending);
      return pending;
    }
    pending = Promise.resolve().then(() => tokenize(text));
    cache.set(text, pending);
    while (cache.size > Math.max(1, capacity)) cache.delete(cache.keys().next().value!);
    pending.catch(() => {
      // An evicted request must not delete a newer request for the same phrase.
      if (cache.get(text) === pending) cache.delete(text);
    });
    return pending;
  };
  return async (segments: string[], provider: (string | undefined)[] = [], preserveSourceReading = false): Promise<string[]> => {
    const text = segments.join("");
    // Supplied phrase readings retain singer-specific pronunciations. Never mix
    // provider fragments with proportionally mapped dictionary fragments.
    if (completeSourceRomaji(segments, provider)) {
      const supplied = provider.slice() as string[];
      if (hasJapanese(text.normalize("NFKC"))) {
        try {
          // Single-character API readings can be isolated on-readings rather
          // than the word selected in context. Correct only a complete aligned
          // token backed by a known dictionary entry, excluding proper names.
          if (!preserveSourceReading) {
            const tokens = await analyze(text.normalize("NFKC"));
            let offset = 0;
            if (tokens.map(t => t.surface_form).join("") === text) {
              for (const token of tokens) {
                const end = offset + token.surface_form.length;
                if (/^\p{Script=Han}$/u.test(token.surface_form) && token.pos_detail_1 !== "固有名詞" &&
                    ((token as any).word_type === "KNOWN" || (token as any).verbose?.word_type === "KNOWN") &&
                    token.reading && /^[\p{Script=Katakana}ー]+$/u.test(token.reading)) {
                  let start = 0;
                  for (let i = 0; i < segments.length; i++) {
                    if (start === offset && start + segments[i].length === end) {
                      const reading = romanizeKana(token.pronunciation || token.reading);
                      if (supplied[i].trim().toLowerCase() !== reading.toLowerCase()) {
                        supplied[i] = supplied[i].replace(/\S(?:[\s\S]*\S)?/u, reading);
                      }
                      break;
                    }
                    start += segments[i].length;
                  }
                }
                offset = end;
              }
            }
          }
          const canonical = await contextualReadings([text], analyze, async value => romanizeKana(value));
          return normalizeRomanizedWhitespace(reconcileJapaneseSpacing(supplied, canonical.join("")));
        } catch { /* Supplied lyrics remain usable without the dictionary. */ }
      }
      return normalizeRomanizedWhitespace(supplied);
    }
    if (!hasJapanese(text.normalize("NFKC"))) return [...segments];
    try {
      const converted = await contextualReadings(segments, analyze, async (reading) => romanizeKana(reading));
      return normalizeRomanizedWhitespace(converted);
    } catch {
      // A dictionary outage or bad alignment must never prevent lyrics loading.
      // Keep supplied readings; otherwise retain unknown kanji and convert kana.
      const fallback = await contextualReadings(segments,
        async () => [{ surface_form: text }], async value => romanizeKana(value));
      return normalizeRomanizedWhitespace(fallback);
    }
  };
}
