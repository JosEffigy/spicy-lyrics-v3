import { contextualReadings, hasJapanese, romanizeKana, type ReadingToken } from "./JapaneseContext.ts";

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
    if (!hasJapanese(text.normalize("NFKC"))) return [...segments];
    try {
      const converted = await contextualReadings(segments, analyze, async (reading) => romanizeKana(reading));
      return converted.map((value, index) =>
        hasJapanese(value) && provider[index]?.trim() && !hasJapanese(provider[index]!)
          ? provider[index]! : value);
    } catch {
      // A dictionary outage or bad alignment must never prevent lyrics loading.
      // Keep supplied readings; otherwise retain unknown kanji and convert kana.
      const fallback = await contextualReadings(segments,
        async () => [{ surface_form: text }], async value => romanizeKana(value));
      return fallback.map((value, index) =>
        provider[index]?.trim() ? provider[index]! : value);
    }
  };
}
