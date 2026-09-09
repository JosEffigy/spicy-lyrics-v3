import Kuroshiro from "kuroshiro";

export const hasSmallTsu = (text: string) => /[っッ]/u.test(text.normalize("NFKC"));
export const romanizeKana = (text: string): string =>
  (Kuroshiro.Util ?? (Kuroshiro as any).default.Util)
    .kanaToRomaji(text.normalize("NFKC"), "hepburn");

export interface ReadingToken {
  surface_form: string;
  reading?: string;
  pronunciation?: string;
  pos?: string;
  pos_detail_1?: string;
}

// Display words are not karaoke beats, nor always individual morphemes.
// Keep inflections, suffixes and prefixes attached; separate particles and
// independent words. Preserve punctuation and explicit source whitespace.
function needsSpace(previous: ReadingToken, current: ReadingToken): boolean {
  const left = previous.surface_form;
  const right = current.surface_form;
  if (!/[\p{L}\p{N}]$/u.test(left) || !/^[\p{L}\p{N}]/u.test(right)) return false;
  if (!hasJapanese(left + right)) return false;
  if (current.pos === "助動詞" || current.pos_detail_1 === "接尾" ||
      previous.pos === "接頭詞") return false;
  if (current.pos === "助詞" && current.pos_detail_1 === "接続助詞" &&
      ["動詞", "形容詞", "助動詞"].includes(previous.pos ?? "")) return false;
  return true;
}

export const hasJapanese = (text: string) =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);

// Keep a full token's reading intact across timing boundaries. The dictionary
// knows word readings, not how a singer apportions them to karaoke segments.
// Internal timing is approximate when a word crosses those boundaries.
export async function contextualReadings(
  segments: string[],
  tokenize: (text: string) => Promise<ReadingToken[]>,
  romanize: (reading: string) => Promise<string>,
): Promise<string[]> {
  const text = segments.join("");
  const output = segments.map(() => "");
  const ends: number[] = [];
  let total = 0;
  for (const segment of segments) ends.push(total += segment.length);
  let firstSegment = 0;
  const distribute = (start: number, end: number, value: string) => {
    const units = value.match(/(?:[bcdfghjklmpqrstvwxyz]*[aeiouāīūēō]|n'|n|[\s\S])/giu) ?? [];
    let previous = 0;
    while (firstSegment < ends.length && ends[firstSegment] <= start) firstSegment++;
    let segmentStart = firstSegment === 0 ? 0 : ends[firstSegment - 1];
    for (let i = firstSegment; i < ends.length && segmentStart < end; i++) {
      const left = Math.max(start, segmentStart);
      const right = Math.min(end, ends[i]);
      if (right > left) {
        const next = right === end ? units.length :
          Math.round(units.length * (right - start) / (end - start));
        output[i] += units.slice(previous, next).join("");
        previous = next;
      }
      segmentStart = ends[i];
    }
  };
  let cursor = 0;
  let previousToken: ReadingToken | undefined;
  const tokens = await tokenize(text);
  for (let index = 0; index < tokens.length; index++) {
    const token = { ...tokens[index] };
    // Sokuon needs the following consonant across tokenizer boundaries.
    let combinedReading = token.pronunciation || token.reading || token.surface_form;
    while (/[っッ]$/u.test(combinedReading.normalize("NFKC")) && index + 1 < tokens.length) {
      const next = tokens[index + 1];
      const nextReading = next.pronunciation || next.reading || next.surface_form;
      const tokenStart = text.indexOf(token.surface_form, cursor);
      if (!/^[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(nextReading) ||
          tokenStart < cursor ||
          !text.slice(tokenStart).startsWith(token.surface_form + next.surface_form)) break;
      token.surface_form += next.surface_form;
      combinedReading += nextReading;
      token.pronunciation = combinedReading;
      index++;
    }
    if (!token.surface_form) continue;
    const start = text.indexOf(token.surface_form, cursor);
    if (start < cursor) throw new Error("Japanese tokenizer lost source alignment");
    if (start > cursor) distribute(cursor, start, text.slice(cursor, start));
    const end = start + token.surface_form.length;
    const reading = [token.pronunciation, token.reading].find(
      (value) => value && value !== "*" &&
        /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(value.normalize("NFKC"))
    );
    // No fabricated reading for unknown kanji: retain the source visibly.
    const converted = hasJapanese(token.surface_form)
      ? await romanize(reading ?? token.surface_form)
      : token.surface_form;
    if (previousToken && start === cursor && needsSpace(previousToken, token)) {
      // Attach the separator to the source boundary, not a proportional slice
      // of the reading (which could insert it inside a split word).
      let target = firstSegment;
      while (target < ends.length && ends[target] <= start) target++;
      if (target < ends.length) output[target] += " ";
    }
    distribute(start, end, converted);
    cursor = end;
    previousToken = token;
  }
  if (cursor < text.length) distribute(cursor, text.length, text.slice(cursor));
  return output;
}
