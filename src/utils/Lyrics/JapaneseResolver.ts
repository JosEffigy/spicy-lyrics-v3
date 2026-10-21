import {analyzeJapaneseText, projectJapanesePlan, romanizeKana,
  type JapaneseReadingPlan, type ReadingToken, type ReadingWord} from "./JapaneseContext.ts";
import {completeSourceRomaji} from "./SourceRomaji.ts";
import {reconcileJapaneseSpacing} from "./JapaneseWordSpacing.ts";
import {normalizeRomanizedWhitespace} from "./RomanizedSegments.ts";

export type ReadingAnnotation = {start: number; end: number; text: string; kana: string};
export type ResolveOptions = {
  supplied?: (string | undefined)[];
  source?: "provider" | "direct";
  annotations?: ReadingAnnotation[];
};
export type WordEvidence = {
  start: number; end: number; text: string; kana: string; romaji: string;
  parts: ReadingWord["parts"]; candidates: string[];
  selectedBy: "literal" | "literal-kana" | "contextual-dictionary" | "supplied-dictionary-match" | "annotation" | "unresolved";
  ambiguous: boolean;
};
export type JapaneseResolution = {
  version: 2; source: string; segments: string[]; words: WordEvidence[];
  outputSource: "analysis" | "supported-provider" | "direct" | "provider-fallback";
  timing: "projected" | "supplied"; issues: string[];
};

// Equate conventional long-vowel spellings, not arbitrary pronunciation.
const key = (value: string) => value.normalize("NFKC").toLowerCase()
  .replace(/[āīūēō]/gu, char => ({ā:"aa",ī:"ii",ū:"uu",ē:"ee",ō:"oo"})[char]!)
  .replace(/\s/gu, "");
const kanaOnly = (value: string) => /^[\p{Script=Hiragana}\p{Script=Katakana}ー\u3099\u309a]+$/u.test(value.normalize("NFKC"));

function wordCandidates(word: ReadingWord): string[] {
  if (word.literal || !word.parts.length) return [word.kana];
  let combinations = [""];
  for (const part of word.parts) {
    const choices = [...new Set([part.kana, ...part.alternatives.filter(kanaOnly)])].slice(0, 8);
    const next: string[] = [];
    outer: for (const prefix of combinations) for (const reading of choices) {
      next.push(prefix + reading);
      if (next.length === 32) break outer;
    }
    combinations = next;
  }
  return [...new Set([word.kana, ...combinations])];
}

// Match complete words monotonically. Karaoke cuts never select readings.
function matchSupplied(candidateKeys: string[][], supplied: string): number[] | undefined {
  const target = key(supplied);
  let states = new Map<number, number[]>([[0, []]]);
  for (let i = 0; i < candidateKeys.length; i++) {
    const next = new Map<number, number[]>();
    for (const [offset, path] of states) {
      for (let c = 0; c < candidateKeys[i].length; c++) {
        const value = candidateKeys[i][c];
        if (target.startsWith(value, offset) && next.size < 64) {
          const end = offset + value.length;
          if (!next.has(end)) next.set(end, [...path, c]);
        }
      }
    }
    states = next;
    if (!states.size) return;
  }
  return states.get(target.length);
}

export function createJapaneseResolver(tokenize: (text: string) => Promise<ReadingToken[]>, capacity = 256) {
  const prepare = (plan: JapaneseReadingPlan) => {
    const candidates = plan.words.map(wordCandidates);
    const romaji = new Map<string, string>();
    const keys = candidates.map((values, i) => values.map(kana => {
      if (!romaji.has(kana)) romaji.set(kana, plan.words[i].literal ? plan.words[i].text : romanizeKana(kana));
      return key(romaji.get(kana)!);
    }));
    return {plan, candidates, romaji, keys};
  };
  const cache = new Map<string, Promise<ReturnType<typeof prepare>>>();
  const analyze = (text: string) => {
    let pending = cache.get(text);
    if (pending) {
      cache.delete(text);
      cache.set(text, pending);
      return pending;
    }
    pending = analyzeJapaneseText(text, tokenize).then(prepare);
    cache.set(text, pending);
    while (cache.size > Math.max(1, capacity)) cache.delete(cache.keys().next().value!);
    pending.catch(() => { if (cache.get(text) === pending) cache.delete(text); });
    return pending;
  };
  return async (segments: string[], options: ResolveOptions = {}): Promise<JapaneseResolution> => {
    const source = segments.join("");
    const issues: string[] = [];
    let prepared: ReturnType<typeof prepare>;
    try { prepared = await analyze(source); }
    catch {
      issues.push("analyzer-unavailable-or-misaligned");
      prepared = prepare(await analyzeJapaneseText(source, async text => [{surface_form: text}]));
    }
    const {plan} = prepared;
    // Annotation conversions live only for this request, not in the LRU.
    const extra = new Map<string, string>();
    const convert = (kana: string) => {
      const cached = prepared.romaji.get(kana) ?? extra.get(kana);
      if (cached !== undefined) return cached;
      const value = romanizeKana(kana);
      extra.set(kana, value);
      return value;
    };
    // Supplied readings and annotations must never mutate cached analysis.
    const words = plan.words.map(word => ({...word}));
    const annotated = new Set<number>();
    const occupied: [number, number][] = [];
    const annotations = Array.isArray(options.annotations) ? options.annotations : [];
    if (options.annotations && !Array.isArray(options.annotations)) issues.push("annotation-rejected");
    for (const annotation of annotations) {
      const valid = annotation && typeof annotation.text === "string" && typeof annotation.kana === "string" &&
        Number.isInteger(annotation.start) && Number.isInteger(annotation.end) &&
        annotation.start >= 0 && annotation.end > annotation.start && annotation.end <= source.length &&
        source.slice(annotation.start, annotation.end) === annotation.text && kanaOnly(annotation.kana) &&
        !occupied.some(([start, end]) => annotation.start < end && annotation.end > start);
      let applied = false;
      if (valid) for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.literal) continue;
        if (word.start === annotation.start && word.end === annotation.end) {
          word.kana = annotation.kana.normalize("NFKC");
          annotated.add(i);
          applied = true;
        } else {
          const part = word.parts.find(p => p.start === annotation.start && p.end === annotation.end);
          if (part) {
            const kana = annotation.kana.normalize("NFKC");
            word.parts = word.parts.map(p => p === part ? {...p, kana, alternatives: [kana]} : p);
            word.kana = word.parts.map(p => p.kana).join("");
            annotated.add(i);
            applied = true;
          }
        }
      }
      if (applied) occupied.push([annotation.start, annotation.end]);
      else issues.push("annotation-rejected");
    }
    const candidates = words.map((word, i) => annotated.has(i) ? [word.kana] : prepared.candidates[i]);
    const candidateKeys = words.map((word, i) => annotated.has(i) ? [key(convert(word.kana))] : prepared.keys[i]);
    const supplied = completeSourceRomaji(segments, options.supplied ?? []) ? options.supplied as string[] : undefined;
    const matching = supplied ? matchSupplied(candidateKeys, supplied.join("")) : undefined;
    if (matching) for (let i = 0; i < words.length; i++) words[i].kana = candidates[i][matching[i]];
    const uncertain = words.some((word, i) => !annotated.has(i) &&
      word.parts.some(part => part.evidence === "unresolved" || part.detail === "固有名詞"));
    if (uncertain) issues.push("unknown-word-or-proper-name");
    if (supplied && !matching) issues.push("supplied-reading-disagrees");
    const generated = normalizeRomanizedWhitespace(await projectJapanesePlan({...plan, words}, segments, convert));
    let result = generated;
    let outputSource: JapaneseResolution["outputSource"] = "analysis";
    if (supplied && matching) {
      result = normalizeRomanizedWhitespace(reconcileJapaneseSpacing(supplied, generated.join("")));
      outputSource = "supported-provider";
    } else if (supplied && !annotated.size &&
        (options.source === "direct" || uncertain || issues.includes("analyzer-unavailable-or-misaligned"))) {
      result = normalizeRomanizedWhitespace(reconcileJapaneseSpacing(supplied, generated.join("")));
      outputSource = options.source === "direct" ? "direct" : "provider-fallback";
      issues.push("supplied-output-not-word-aligned");
    }
    return {
      version: 2, source, segments: result, outputSource,
      timing: outputSource === "analysis" ? "projected" : "supplied", issues,
      words: words.map((word, i) => ({
        start: word.start, end: word.end, text: word.text, kana: word.kana,
        romaji: word.literal ? word.text : convert(word.kana),
        parts: word.parts.map(part => ({...part, alternatives: [...part.alternatives]})),
        candidates: [...candidates[i]], ambiguous: candidates[i].length > 1,
        selectedBy: annotated.has(i) ? "annotation" : word.literal ? "literal" :
          word.parts.some(part => part.evidence === "unresolved") ? "unresolved" :
          matching ? "supplied-dictionary-match" :
          word.parts.every(part => part.evidence === "literal-kana") ? "literal-kana" : "contextual-dictionary",
      })),
    };
  };
}
