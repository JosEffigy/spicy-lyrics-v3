import {test} from "node:test";
import assert from "node:assert/strict";
import {reconcileJapaneseSpacing} from "./JapaneseWordSpacing.ts";
import {romanizedSegments, normalizeRomanizedWhitespace} from "./RomanizedSegments.ts";

test("whole-phrase agreement repairs word boundaries without changing letters", () => {
  for (const [supplied, canonical] of [
    ["waratte age ru", "waratte ageru"], ["shite ran nai yo", "shiterannai yo"],
    ["ii n janai no", "iin janai no"], ["wata shiwa", "watashi wa"],
    ["tabe rare nai", "taberarenai"], ["okane ganai", "okane ga nai"],
  ]) assert.equal(reconcileJapaneseSpacing([supplied], canonical).join(""), canonical);
});

test("different supplied pronunciation still allows an unambiguous intact-word repair", () => {
  assert.deepEqual(reconcileJapaneseSpacing(["son toki wa waratte age ru"], "sono toki wa waratte ageru"),
    ["son toki wa waratte ageru"]);
  assert.deepEqual(reconcileJapaneseSpacing(["special nda"], "yomunda"), ["special nda"]);
  assert.deepEqual(reconcileJapaneseSpacing(["age ru age ru"], "ageru special"), ["age ru age ru"]);
});

test("spacing edits preserve timing partitions and capitalization", () => {
  assert.deepEqual(reconcileJapaneseSpacing(["Waratte ", "Age", " Ru"], "waratte ageru"), ["Waratte", " Age", "Ru"]);
  assert.deepEqual(reconcileJapaneseSpacing(["wata", "shiwa"], "watashi wa"), ["wata", "shi wa"]);
});

test("whitespace collapses across empty beats and timing boundaries", () => {
  assert.deepEqual(normalizeRomanizedWhitespace(["  waratte ", "", " \t", "ageru  "]),
    ["waratte", "", "", " ageru"]);
  assert.deepEqual(normalizeRomanizedWhitespace(["wata", "shi", "  wa"]), ["wata", "shi", " wa"]);
  assert.deepEqual(normalizeRomanizedWhitespace(["a\u3000\u00a0b"]), ["a b"]);
});

test("renderer removes boundary whitespace while preserving one internal gap", () => {
  const result = romanizedSegments([
    {TransliteratedText: " age", IsPartOfWord: false, RomanizedIsPartOfWord: true},
    {TransliteratedText: "ru", IsPartOfWord: false, RomanizedIsPartOfWord: false},
    {TransliteratedText: "  kimi  wa ", RomanizedIsPartOfWord: false},
  ], true);
  assert.deepEqual(result.map(s => s.TransliteratedText), ["age", "ru", "kimi wa"]);
  assert.deepEqual(result.map(s => s.IsPartOfWord), [true, false, false]);
});
