import { contextualReadings, hasJapanese, joinSuppliedContractions, romanizeKana, type ReadingToken } from "./JapaneseContext.ts";
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
  return async (segments: string[], provider: (string | undefined)[] = []): Promise<string[]> => {
    const text = segments.join("");
    // Supplied phrase readings retain singer-specific pronunciations. Never mix
    // provider fragments with proportionally mapped dictionary fragments.
    if (completeSourceRomaji(segments, provider)) {
      const supplied = provider.slice() as string[];
      if (/ん/u.test(text) && /\s+n\s*[a-z]/iu.test(supplied.join(""))) {
        try {
          const tokens = await analyze(text.normalize("NFKC"));
          if (tokens.map(token => token.surface_form).join("") === text.normalize("NFKC")) {
            return joinSuppliedContractions(tokens, supplied);
          }
        } catch { /* Supplied lyrics remain usable without the dictionary. */ }
      }
      return supplied;
    }
    if (!hasJapanese(text.normalize("NFKC"))) return [...segments];
    try {
      const converted = await contextualReadings(segments, analyze, async (reading) => romanizeKana(reading));
      return converted;
    } catch {
      // A dictionary outage or bad alignment must never prevent lyrics loading.
      // Keep supplied readings; otherwise retain unknown kanji and convert kana.
      const fallback = await contextualReadings(segments,
        async () => [{ surface_form: text }], async value => romanizeKana(value));
      return fallback;
    }
  };
}
