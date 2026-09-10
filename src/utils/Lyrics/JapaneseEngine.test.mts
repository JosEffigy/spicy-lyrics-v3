import { test } from "node:test";
import assert from "node:assert/strict";
import { createJapaneseEngine } from "./JapaneseEngine.ts";

test("shares concurrent analysis across different karaoke boundaries", async () => {
  let calls = 0;
  const engine = createJapaneseEngine(async () => {
    calls++;
    return [{surface_form: "きって", reading: "キッテ"}];
  });
  const result = await Promise.all([engine(["き", "っ", "て"]), engine(["きって"])]);
  assert.deepEqual(result.map(parts => parts.join("")), ["kitte", "kitte"]);
  assert.equal(calls, 1);
});

test("failure preserves supplied readings and original unknown kanji, then retries", async () => {
  let calls = 0;
  const engine = createJapaneseEngine(async () => {
    if (++calls === 1) throw Error("offline");
    return [{surface_form: "今日", reading: "キョウ"}];
  });
  assert.deepEqual(await engine(["今日"], ["kyou"]), ["kyou"]);
  assert.equal(calls, 1);
  assert.deepEqual(await engine(["今日"]), ["kyou"]);
  assert.equal(calls, 2);
  const offline = createJapaneseEngine(async () => { throw Error("offline"); });
  assert.deepEqual(await offline(["𠮷"]), ["𠮷"]);
});

test("bounded LRU cache evicts least recently used phrase", async () => {
  let calls = 0;
  const engine = createJapaneseEngine(async surface_form => {
    calls++;
    return [{surface_form}];
  }, 2);
  for (const text of ["あ", "い", "あ", "う", "い"]) await engine([text]);
  assert.equal(calls, 4);
});

test("invalid alignment falls back without rejecting lyric processing", async () => {
  const engine = createJapaneseEngine(async () => [{surface_form: "昨日"}]);
  assert.deepEqual(await engine(["今日"], ["kyou"]), ["kyou"]);
});

test("preserves supplied readings rather than guessing whether Latin text is correct", async () => {
  const engine = createJapaneseEngine(async surface_form => [{surface_form}]);
  assert.deepEqual(await engine(["みった"], ["mitsuta"]), ["mitsuta"]);
  assert.deepEqual(await engine(["みった"]), ["mitta"]);
  assert.deepEqual(await engine(["Hello, world!"]), ["Hello, world!"]);
});

test("offline fallback keeps small-tsu context across timing boundaries", async () => {
  const engine = createJapaneseEngine(async () => { throw Error("offline"); });
  assert.equal((await engine(["み", "っ", "た"])).join(""), "mitta");
});
