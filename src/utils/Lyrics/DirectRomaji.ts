import { hasJapanese } from "./JapaneseContext.ts";
import { completeSourceRomaji, sourceRomaji } from "./SourceRomaji.ts";

export type TrackMatch = { title: string; artist: string; duration: number };
type TimedLine = { time: number; text: string };
export type RomajiRecord = { id: number; trackName: string; artistName: string;
  duration: number; syncedLyrics: string; instrumental?: boolean };
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const titles = (s: string) => [s, ...s.split(/\s+-\s+/)].map(normalize).filter(Boolean);

export function parseTimedRomaji(lrc: string, duration: number): TimedLine[] {
  if (typeof lrc !== "string" || lrc.length > 100000) return [];
  const lines: TimedLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    if (/^\[offset:/i.test(raw)) return [];
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (!text) continue;
    if (hasJapanese(text) || /[\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}]/u.test(text)) return [];
    for (const stamp of stamps) {
      if (+stamp[2] >= 60) return [];
      const time = +stamp[1] * 60 + +stamp[2] + Number("0." + (stamp[3] ?? "0"));
      if (time > duration) return [];
      lines.push({time, text});
    }
  }
  lines.sort((a, b) => a.time - b.time);
  if (lines.some((line, i) => i > 0 && line.time === lines[i - 1].time)) return [];
  return lines;
}

function similarity(a: string, b: string) {
  // Reject unrelated Latin text (e.g. translations), while allowing individual
  // dictionary mistakes. This is a matching heuristic, not reading verification.
  const grams = (text: string) => {
    const value = normalize(text.normalize("NFD").replace(/\p{M}/gu, ""));
    return new Set(Array.from({length: Math.max(0, value.length - 1)}, (_, i) => value.slice(i, i + 2)));
  };
  const x = grams(a), y = grams(b);
  return !x.size || !y.size ? 0 : 2 * [...x].filter(g => y.has(g)).length / (x.size + y.size);
}

export function referenceLines(lyrics: any): TimedLine[] {
  if (!["Syllable", "Line"].includes(lyrics.Type)) return [];
  return (lyrics.Content ?? []).filter((g: any) => g.Type === "Vocal").map((g: any) => ({
    time: lyrics.Type === "Syllable" ? g.Lead.StartTime : g.StartTime,
    text: lyrics.Type === "Syllable"
      ? g.Lead.Syllables.map((s: any) => s.TransliteratedText ?? s.Text).join("")
      : g.TransliteratedText ?? g.Text,
  })).filter((line: TimedLine) => Number.isFinite(line.time) && line.text.trim());
}

export function needsDirectRomaji(lyrics: any): boolean {
  if (!["Syllable", "Line"].includes(lyrics.Type)) return false;
  return (lyrics.Content ?? []).some((g: any) => {
    if (g.Type !== "Vocal") return false;
    const entries = lyrics.Type === "Syllable" ? g.Lead.Syllables : [g];
    const text = entries.map((s: any) => s.Text);
    return hasJapanese(text.join("")) && !completeSourceRomaji(text, entries.map(sourceRomaji));
  });
}

export function selectDirectRomaji(records: RomajiRecord[], track: TrackMatch, reference: TimedLine[]) {
  if (reference.length < 4 || !track.title || !track.artist || !Number.isFinite(track.duration) || track.duration <= 0) return null;
  const matches: {record: RomajiRecord; lines: TimedLine[]; score: number}[] = [];
  for (const record of records.slice(0, 100)) {
    if (!record || typeof record.trackName !== "string" || typeof record.artistName !== "string" ||
        !Number.isFinite(record.id) || record.instrumental || !Number.isFinite(record.duration) ||
        Math.abs(record.duration - track.duration) > 2 ||
        normalize(record.artistName) !== normalize(track.artist) ||
        !titles(record.trackName).some(t => titles(track.title).includes(t))) continue;
    const lines = parseTimedRomaji(record.syncedLyrics, track.duration);
    if (lines.length !== reference.length) continue;
    // Full-line alignment only. No made-up word timing or cross-source fragments.
    if (lines.some((line, i) => Math.abs(line.time - reference[i].time) > 1.5)) continue;
    const scores = lines.map((line, i) => similarity(line.text, reference[i].text));
    if (scores.filter(score => score >= 0.55).length / scores.length < 0.8) continue;
    matches.push({record, lines, score: scores.reduce((a, b) => a + b, 0) / scores.length});
  }
  matches.sort((a, b) => b.score - a.score);
  if (!matches.length) return null;
  const best = matches[0];
  if (matches.slice(1).some(other => best.score - other.score < 0.05 &&
      normalize(other.lines.map(l => l.text).join("")) !== normalize(best.lines.map(l => l.text).join("")))) return null;
  return {
    Type: "Line", source: "lrclib", HasTransliterations: true,
    StartTime: best.lines[0].time, SakuraDirectSourceId: best.record.id,
    Content: best.lines.map((line, i) => ({
      Type: "Vocal", Text: line.text, TransliteratedText: line.text,
      StartTime: line.time, EndTime: best.lines[i + 1]?.time ?? track.duration,
    })),
  };
}

export function createDirectRomajiLookup(request: typeof fetch = fetch) {
  const cache = new Map<string, {expires: number; result: Promise<RomajiRecord[]>}>();
  let retryAfter = 0;
  return async (track: TrackMatch, reference: TimedLine[]) => {
    if (Date.now() < retryAfter || reference.length < 4 || !track.title || !track.artist) return null;
    const key = JSON.stringify(track);
    let entry = cache.get(key);
    if (!entry || entry.expires <= Date.now()) {
      const result = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const url = new URL("https://lrclib.net/api/search");
          url.searchParams.set("track_name", track.title.split(/\s+-\s+/).at(-1)!);
          url.searchParams.set("artist_name", track.artist);
          const res = await request(url.toString(), {signal: controller.signal,
            headers: {"Lrclib-Client": "Sakura Lyrics (https://github.com/JosEffigy/spicy-lyrics-v3)"}});
          if (!res.ok) {
            const header = res.headers.get("Retry-After");
            const seconds = Number(header);
            const delay = header && !Number.isFinite(seconds) ? Date.parse(header) - Date.now() : seconds * 1000;
            retryAfter = Date.now() + Math.max(30000, Number.isFinite(delay) ? delay : 30000);
            return [];
          }
          const body = await res.text();
          if (body.length > 2000000) return [];
          const data = JSON.parse(body);
          return Array.isArray(data) ? data : [];
        } catch { retryAfter = Date.now() + 30000; return []; }
        finally { clearTimeout(timer); }
      })();
      entry = {expires: Date.now() + 5 * 60 * 1000, result};
      cache.delete(key);
      cache.set(key, entry);
      while (cache.size > 32) cache.delete(cache.keys().next().value!);
    }
    return selectDirectRomaji(await entry.result, track, reference);
  };
}
