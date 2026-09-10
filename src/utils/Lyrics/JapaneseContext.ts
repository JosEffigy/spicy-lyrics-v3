import Kuroshiro from "kuroshiro";

export const hasSmallTsu = (text: string) => /[っッ]/u.test(text.normalize("NFKC"));
export const romanizeKana = (text: string): string => {
  // One script also handles hiragana vu and mixed-script contracted sounds.
  let kana = text.normalize("NFKC").replace(/[ぁ-ゖ]/gu,
    value => String.fromCodePoint(value.codePointAt(0)! + 0x60));
  kana = kana.replace(/([ァ-ヺ])([ゝゞヽヾ])/gu, (whole, base, mark) => {
    const plain = base.normalize("NFD").replace(/[\u3099\u309a]/gu, "");
    const repeated = /[ゞヾ]/u.test(mark) ? (plain + "\u3099").normalize("NFC") : plain;
    return /^[ァ-ヺ]$/u.test(repeated) ? base + repeated : whole;
  });
  return (Kuroshiro.Util ?? (Kuroshiro as any).default.Util).kanaToRomaji(kana, "hepburn");
};

export interface ReadingToken {
  surface_form: string;
  reading?: string;
  pronunciation?: string;
  pos?: string;
  pos_detail_1?: string;
  basic_form?: string;
}

// Display words are not karaoke beats, nor always individual morphemes.
// Keep inflections, suffixes and prefixes attached; separate particles and
// independent words. Preserve punctuation and explicit source whitespace.
function needsSpace(previous: ReadingToken, current: ReadingToken, next?: ReadingToken): boolean {
  const left = previous.surface_form;
  const right = current.surface_form;
  if (!/[\p{L}\p{N}]$/u.test(left) || !/^[\p{L}\p{N}]/u.test(right)) return false;
  if (!hasJapanese(left + right)) return false;
  // Contracted explanatory の: 読む + ん + だ -> yomunda. An independent
  // noun or an unclassified ん must not be attached just because it sounds n.
  if (right === "ん" && current.pos === "名詞" && current.pos_detail_1 === "非自立" &&
      (next?.pos === "助動詞" || next?.surface_form === "じゃ" || next?.surface_form === "で")) return false;
  if (current.pos === "助動詞" || current.pos_detail_1 === "接尾" ||
      previous.pos === "接頭詞") return false;
  if (current.pos === "動詞" && current.pos_detail_1 === "非自立" &&
      ["てる", "でる", "ちゃう", "じゃう", "とく", "どく"].includes(current.basic_form ?? "") &&
      ["動詞", "助動詞"].includes(previous.pos ?? "")) return false;
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
  const source = segments.join("");
  // Normalize before dictionary analysis, retaining original timing offsets.
  // Graphemes keep decomposed dakuten and half-width voiced kana together.
  let text = "";
  const offsets = [0];
  for (const { segment, index } of new Intl.Segmenter("ja", {granularity: "grapheme"}).segment(source)) {
    const normalized = segment.normalize("NFKC");
    for (let i = 0; i < normalized.length; i++) offsets.push(index + segment.length);
    text += normalized;
  }
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
  const tokens = await tokenize(text);
  // IPADIC can parse the colloquial potential-negative contraction てらんない
  // as a noun followed by an adjective. Repair only that grammatical context,
  // retaining the literal reading and leaving independent nouns untouched.
  const contractedBoundaries = new Set<number>();
  for (let i = 2; i + 1 < tokens.length; i++) {
    const connector = tokens[i - 1];
    if (tokens[i].surface_form === "らん" &&
        connector.pos === "助詞" && connector.pos_detail_1 === "接続助詞" &&
        /^[てで]$/u.test(connector.surface_form) && tokens[i - 2].pos === "動詞" &&
        /^な[いかくけ]/u.test(tokens[i + 1].surface_form) &&
        ["形容詞", "助動詞"].includes(tokens[i + 1].pos ?? "")) {
      contractedBoundaries.add(i);
      contractedBoundaries.add(i + 1);
    }
  }
  for (let i = 2; i < tokens.length; i++) {
    // Negative omission of いる: 読んでない. Contrast お金がない,
    // whose case particle does not form a verb connective.
    if (tokens[i].basic_form === "ない" && ["形容詞", "助動詞"].includes(tokens[i].pos ?? "") &&
        tokens[i - 1].pos === "助詞" && tokens[i - 1].pos_detail_1 === "接続助詞" &&
        /^[てで]$/u.test(tokens[i - 1].surface_form) && tokens[i - 2].pos === "動詞") {
      contractedBoundaries.add(i);
    }
  }
  let groupStart = 0;
  let groupEnd = 0;
  let groupReading = "";
  let previousToken: ReadingToken | undefined;
  const flush = async () => {
    if (groupEnd > groupStart) distribute(offsets[groupStart], offsets[groupEnd], await romanize(groupReading));
    groupReading = "";
  };
  const separate = (start: number) => {
    let target = firstSegment;
    while (target < ends.length && ends[target] <= offsets[start]) target++;
    if (target < ends.length) output[target] += " ";
  };
  const readingOf = (token: ReadingToken) => {
    // Literal kana preserves small letters even if an unknown-word dictionary
    // entry expands them. Particles need contextual ワ/エ/オ pronunciations.
    if (/^[\p{Script=Hiragana}\p{Script=Katakana}ー\u3099\u309a]+$/u.test(token.surface_form) &&
        token.pos !== "助詞" && (token.pos || (!token.pronunciation && !token.reading) ||
          /[ゃゅょャュョぁぃぅぇぉァィゥェォっッゎヮ]/u.test(token.surface_form))) return token.surface_form;
    return [token.pronunciation, token.reading].find(value => value && value !== "*" &&
      /^[\p{Script=Hiragana}\p{Script=Katakana}ー\u3099\u309a]+$/u.test(value.normalize("NFKC"))) ?? token.surface_form;
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.surface_form) continue;
    const start = text.indexOf(token.surface_form, cursor);
    if (start < cursor) throw new Error("Japanese tokenizer lost source alignment");
    const end = start + token.surface_form.length;
    if (!hasJapanese(token.surface_form) && !/^[ー\u3099\u309a]+$/u.test(token.surface_form)) {
      await flush();
      if (previousToken && start === cursor && needsSpace(previousToken, token)) separate(start);
      distribute(offsets[cursor], offsets[end], source.slice(offsets[cursor], offsets[end]));
      cursor = end;
      previousToken = token;
      continue;
    }
    const reading = readingOf(token);
    const phoneticJoin = /[っッ]$/u.test(groupReading) && /^[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(reading) ||
      /[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u.test(groupReading) &&
      /^[ゃゅょャュョぁぃぅぇぉァィゥェォっッゎヮーゝゞヽヾ\u3099\u309a]/u.test(token.surface_form);
    const space = previousToken && start === cursor && !phoneticJoin && !contractedBoundaries.has(index) && needsSpace(previousToken, token, tokens[index + 1]);
    if (start > cursor || space) {
      await flush();
      if (start > cursor) distribute(offsets[cursor], offsets[start], source.slice(offsets[cursor], offsets[start]));
    }
    if (space) {
      // Attach the separator to the source boundary, not a proportional slice
      // of the reading (which could insert it inside a split word).
      separate(start);
    }
    if (!groupReading) groupStart = start;
    groupEnd = end;
    groupReading += reading;
    cursor = end;
    previousToken = token;
  }
  await flush();
  if (cursor < text.length) distribute(offsets[cursor], source.length, source.slice(offsets[cursor]));
  return output;
}
