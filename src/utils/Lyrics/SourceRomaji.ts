// Provenance is not a claim of linguistic accuracy. It distinguishes supplied
// lyrics from our generated guesses and survives JSON cache round-trips.
export function captureSourceRomaji(target: any) {
  target.SakuraSourceRomaji = {
    text: target.Text,
    reading: typeof target.TransliteratedText === "string" ? target.TransliteratedText : null,
  };
}

export function sourceRomaji(target: any): string | undefined {
  const source = target.SakuraSourceRomaji;
  return source?.text === target.Text && typeof source.reading === "string"
    ? source.reading : undefined;
}

export function completeSourceRomaji(segments: string[], readings: (string | undefined)[]) {
  return segments.length > 0 && readings.length === segments.length &&
    readings.some(value => typeof value === "string" && /\p{Script=Latin}/u.test(value)) &&
    segments.every((text, index) => {
      const value = readings[index];
      return typeof value === "string" &&
        (!text.trim() || !!value.trim()) &&
        !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value.normalize("NFKC"));
    });
}
