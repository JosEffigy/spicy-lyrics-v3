import { test } from "node:test";
import assert from "node:assert/strict";
import { contextualReadings, hasJapanese } from "./JapaneseContext.ts";

test("tokenizes the whole compound across karaoke boundaries", async () => {
  const result = await contextualReadings(["今", "日", "は"],
    async (text) => {
      assert.equal(text, "今日は");
      return [{ surface_form: "今日", reading: "キョウ" },
        { surface_form: "は", pronunciation: "ワ" }];
    },
    async (kana) => ({ "キョウ": "kyō", "ワ": "wa" }[kana] ?? kana));
  assert.equal(result.join(""), "kyōwa");
  assert.equal(result.length, 3);
});

test("preserves unknown kanji, punctuation, English and gaps", async () => {
  const result = await contextualReadings(["𠮷!", " right"],
    async () => [{ surface_form: "𠮷", reading: "*" },
      { surface_form: "right" }], async (value) => value);
  assert.equal(result.join(""), "𠮷! right");
  assert.equal(hasJapanese("𠮷"), true);
});

test("rejects misaligned tokenizer output", async () => {
  await assert.rejects(contextualReadings(["今日"], async () =>
    [{ surface_form: "昨日", reading: "キノウ" }], async (s) => s));
});
