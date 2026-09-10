import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimedRomaji, selectDirectRomaji, createDirectRomajiLookup,
  needsDirectRomaji, type RomajiRecord } from "./DirectRomaji.ts";

const track = {title: "Example", artist: "Test Artist", duration: 90};
const reference = ["watashi wa aruku", "kimi wa utau", "sora ga aoi", "hana ga saku", "ashita mo aruku"]
  .map((text, i) => ({time: 10 + i * 10, text}));
const record: RomajiRecord = {id: 1, trackName: "Example", artistName: "Test Artist",
  duration: 90, syncedLyrics: reference.map(l => "[00:" + l.time + ".00] " + l.text).join("\n")};

test("matching source uses supplied line timings and retains its attribution", () => {
  const selected = selectDirectRomaji([record], track, reference)!;
  assert.equal(selected.source, "lrclib");
  assert.equal(selected.Type, "Line");
  assert.equal(selected.Content[0].StartTime, 10);
  assert.equal(selected.Content[4].EndTime, 90);
  assert.equal(selected.SakuraDirectSourceId, 1);
});

test("rejects wrong recording, title, artist, line count and timing", () => {
  for (const patch of [{duration: 110}, {trackName: "Other"},
    {artistName: "Other"}, {syncedLyrics: record.syncedLyrics + "\n[01:00] extra"},
    {syncedLyrics: record.syncedLyrics.replace("00:10", "00:14")}]) {
    assert.equal(selectDirectRomaji([{...record, ...patch}], track, reference), null);
  }
});

test("Latin translations and ambiguous conflicting readings are not silently selected", () => {
  const translated = {...record, syncedLyrics: reference.map(l => "[00:" + l.time + "] the weather is beautiful today").join("\n")};
  assert.equal(selectDirectRomaji([translated], track, reference), null);
  const other = {...record, id: 2, syncedLyrics: record.syncedLyrics.replace("ashita", "asita")};
  assert.equal(selectDirectRomaji([record, other], track, reference), null);
});

test("one uncertain dictionary phrase doesn't prevent the other lines establishing a match", () => {
  const source = {...record, syncedLyrics: record.syncedLyrics.replace("ashita mo aruku", "asu mo aruku")};
  assert.ok(selectDirectRomaji([source], track, reference));
});

test("malformed LRC, unsupported offsets and residual Japanese are rejected", () => {
  for (const lrc of ["[00:99] bad", "[offset:500]\n[00:10] hello", "[00:10] 私",
    "[00:10] hi\n[00:10] duplicate", "[02:00] late"]) {
    assert.deepEqual(parseTimedRomaji(lrc, 90), []);
  }
});

test("lookup deduplicates concurrent requests and uses an identifying header", async () => {
  let calls = 0;
  const lookup = createDirectRomajiLookup((async (_url, init) => {
    calls++;
    assert.ok(init?.headers?.["Lrclib-Client"]);
    return new Response(JSON.stringify([record]));
  }) as typeof fetch);
  const result = await Promise.all([lookup(track, reference), lookup(track, reference)]);
  assert.equal(calls, 1);
  assert.ok(result.every(Boolean));
});

test("rate limits stop repeated requests across different tracks", async () => {
  let calls = 0;
  const lookup = createDirectRomajiLookup((async () => {
    calls++;
    return new Response("", {status: 429, headers: {"Retry-After": "60"}});
  }) as typeof fetch);
  assert.equal(await lookup(track, reference), null);
  assert.equal(await lookup({...track, title: "Another"}, reference), null);
  assert.equal(calls, 1);
});

test("complete source romaji and local non-Japanese lyrics need no extra lookup", () => {
  const group = {Type: "Vocal", Text: "私", TransliteratedText: "watashi",
    SakuraSourceRomaji: {text: "私", reading: "watashi"}};
  assert.equal(needsDirectRomaji({Type: "Line", Content: [group]}), false);
  assert.equal(needsDirectRomaji({Type: "Line", Content: [{...group, SakuraSourceRomaji: undefined}]}), true);
});
