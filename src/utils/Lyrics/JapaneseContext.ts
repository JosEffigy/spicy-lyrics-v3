export interface ReadingToken {
  surface_form: string;
  reading?: string;
  pronunciation?: string;
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
  const distribute = (start: number, end: number, value: string) => {
    const units = value.match(/(?:[bcdfghjklmpqrstvwxyz]*[aeiouāīūēō]|n'|n|[\s\S])/giu) ?? [];
    let previous = 0;
    let segmentStart = 0;
    for (let i = 0; i < ends.length; i++) {
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
  for (const token of await tokenize(text)) {
    if (!token.surface_form) continue;
    const start = text.indexOf(token.surface_form, cursor);
    if (start < cursor) throw new Error("Japanese tokenizer lost source alignment");
    if (start > cursor) distribute(cursor, start, text.slice(cursor, start));
    const end = start + token.surface_form.length;
    const reading = [token.pronunciation, token.reading].find(
      (value) => value && value !== "*" && !/\p{Script=Han}/u.test(value)
    );
    // No fabricated reading for unknown kanji: retain the source visibly.
    const converted = hasJapanese(token.surface_form)
      ? await romanize(reading ?? token.surface_form)
      : token.surface_form;
    distribute(start, end, converted);
    cursor = end;
  }
  if (cursor < text.length) distribute(cursor, text.length, text.slice(cursor));
  return output;
}
