import type { ReadingToken } from "./JapaneseContext.ts";
import {createJapaneseResolver} from "./JapaneseResolver.ts";

// Compatibility adapter; the resolver is the single reading-policy owner.
export function createJapaneseEngine(tokenize: (text: string) => Promise<ReadingToken[]>, capacity = 256) {
  const resolve = createJapaneseResolver(tokenize, capacity);
  const engine = async (segments: string[], supplied: (string | undefined)[] = [], preserveSourceReading = false) =>
    (await resolve(segments, {supplied, source: preserveSourceReading ? "direct" : "provider"})).segments;
  return Object.assign(engine, {resolve});
}
