import { test } from "node:test";
import assert from "node:assert/strict";
import { captureSourceRomaji, sourceRomaji, completeSourceRomaji } from "./SourceRomaji.ts";
import { createJapaneseEngine } from "./JapaneseEngine.ts";

test("raw source survives generated display changes and cache serialization", () => {
  const item = {Text: "明日", TransliteratedText: "asu"};
  captureSourceRomaji(item);
  item.TransliteratedText = "ashita";
  const cached = JSON.parse(JSON.stringify(item));
  assert.equal(sourceRomaji(cached), "asu");
  cached.Text = "昨日";
  assert.equal(sourceRomaji(cached), undefined);
  assert.equal(sourceRomaji({Text: "明日", TransliteratedText: "ashita"}), undefined);
});

test("complete source survives dictionary failure and preserves pronunciation", async () => {
  const engine = createJapaneseEngine(async () => { throw Error("must not run"); });
  assert.deepEqual(await engine(["明", "日"], ["a", "su"]), ["a", "su"]);
  assert.equal(completeSourceRomaji(["私", "は"], ["watashi", " wa"]), true);
  assert.equal(completeSourceRomaji(["私", "は"], ["watashi", "は"]), false);
  assert.equal(completeSourceRomaji(["私", "は"], ["watashi"]), false);
});

test("partial provider fragments never splice into whole-token generated mapping", async () => {
  const engine = createJapaneseEngine(async () => [{surface_form: "今日", reading: "キョウ"}]);
  const result = await engine(["今", "日"], ["today", undefined]);
  assert.equal(result.join(""), "kyou");
});
