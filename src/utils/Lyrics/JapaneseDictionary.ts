import type { ReadingToken } from "./JapaneseContext.ts";

// Kuromoji's selected path already uses sentence-level connection costs. Keep
// same-surface lexical alternatives as evidence, not as context-free overrides.
// Optional internals: a different browser build may expose only tokenize().
export function tokenizeWithCandidates(analyzer: any, text: string): ReadingToken[] {
  const result = analyzer.tokenize(text) as ReadingToken[];
  const trie = analyzer.viterbi_builder?.trie;
  const dictionary = analyzer.token_info_dictionary;
  return result.map(token => {
    const candidates: string[] = [];
    if (token.word_type === "KNOWN" && /\p{Script=Han}/u.test(token.surface_form)) {
      try {
        const id = trie?.lookup(token.surface_form);
        const entries = dictionary?.target_map?.[id] ?? [];
        for (const entry of entries.slice(0, 128)) {
          const fields = dictionary.getFeatures(entry).split(",");
          if (fields[0] !== token.surface_form || fields[1] !== token.pos ||
              fields[2] !== token.pos_detail_1 || fields[6] !== token.conjugated_form) continue;
          const reading = fields[9] && fields[9] !== "*" ? fields[9] : fields[8];
          if (/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(reading ?? "") && !candidates.includes(reading)) {
            candidates.push(reading);
          }
          if (candidates.length >= 8) break;
        }
      } catch { /* Lexical alternatives are optional; keep the contextual path. */ }
    }
    return {...token, reading_candidates: candidates};
  });
}
