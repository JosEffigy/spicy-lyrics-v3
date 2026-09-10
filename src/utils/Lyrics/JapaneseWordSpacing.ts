// Transfer boundaries only where the supplied letters agree with the analyzed
// reading. Pronunciation, capitalization, punctuation, and timing stay supplied.
export function reconcileJapaneseSpacing(supplied: string[], canonical: string): string[] {
  const text = supplied.join("");
  const compact = (value: string) => value.replace(/\s/gu, "").toLowerCase();
  const removed = new Set<number>();
  const inserted = new Set<number>();
  if (compact(text) === compact(canonical)) {
    const boundaries = new Set<number>();
    let offset = 0;
    for (const c of canonical) {
      if (/\s/u.test(c)) boundaries.add(offset);
      else offset += c.length;
    }
    offset = 0;
    for (let i = 0; i < text.length; i++) {
      if (/\s/u.test(text[i])) removed.add(i);
      else {
        if (offset > 0 && boundaries.has(offset)) inserted.add(i);
        offset++;
      }
    }
  } else {
    // A different sung reading elsewhere must not block a verified word repair.
    // Unique whole-word matches prevent guessing which repeated word to alter.
    const words = canonical.match(/[\p{Script=Latin}']+/gu) ?? [];
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word.toLowerCase(), (counts.get(word.toLowerCase()) ?? 0) + 1);
    for (const [word, count] of counts) {
      if (count !== 1 || word.length < 3) continue;
      const pattern = new RegExp(`(?<![\\p{L}'])${Array.from(word).join("\\s*")}(?![\\p{L}'])`, "giu");
      const matches = [...text.matchAll(pattern)];
      if (matches.length !== 1) continue;
      const match = matches[0];
      for (let i = 0; i < match[0].length; i++) if (/\s/u.test(match[0][i])) removed.add(match.index! + i);
    }
  }
  let offset = 0;
  return supplied.map(value => {
    let result = "";
    for (let i = 0; i < value.length; i++, offset++) {
      if (inserted.has(offset)) result += " ";
      if (!removed.has(offset)) result += value[i];
    }
    return result;
  });
}
