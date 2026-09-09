import { test } from "node:test";
import assert from "node:assert/strict";
import { contextualReadings, romanizeKana, type ReadingToken } from "./JapaneseContext.ts";
import { romanizedSegments } from "./RomanizedSegments.ts";

const token = (surface_form: string, pronunciation: string, pos = "名詞",
  pos_detail_1 = "一般"): ReadingToken => ({surface_form, pronunciation, pos, pos_detail_1});
const cases: [string, ReadingToken[], string][] = [
  ["particles", [token("私", "ワタシ"), token("は", "ワ", "助詞"), token("学校", "ガッコウ"),
    token("へ", "エ", "助詞"), token("行く", "イク", "動詞")], "watashi wa gakkou e iku"],
  ["inflection", [token("食べ", "タベ", "動詞"), token("まし", "マシ", "助動詞"),
    token("た", "タ", "助動詞")], "tabemashita"],
  ["connective", [token("見", "ミ", "動詞"), token("て", "テ", "助詞", "接続助詞"),
    token("いる", "イル", "動詞")], "mite iru"],
  ["compound token", [token("図書館", "トショカン"), token("で", "デ", "助詞")], "toshokan de"],
  ["prefix and suffix", [token("お", "オ", "接頭詞"), token("客", "キャク"),
    token("様", "サマ", "名詞", "接尾")], "okyakusama"],
  ["punctuation", [token("猫", "ネコ"), token("、", "、", "記号"),
    token("犬", "イヌ"), token("。", "。", "記号")], "neko、inu。"],
  ["mixed scripts", [token("君", "キミ"), token("と", "ト", "助詞"),
    token("music", "music")], "kimi to music"],
  ["sokuon inflection", [token("待っ", "マッ", "動詞"),
    token("た", "タ", "助動詞"), token("よ", "ヨ", "助詞")], "matta yo"],
];

for (const [name, tokens, expected] of cases) {
  test(name + ": spacing is independent of every possible two-way karaoke split", async () => {
    const text = tokens.map(t => t.surface_form).join("");
    const variants = [[text], Array.from(text)];
    for (let i = 1; i < text.length; i++) variants.push([text.slice(0, i), text.slice(i)]);
    for (const segments of variants) {
      const result = await contextualReadings(segments, async () => tokens, async s => romanizeKana(s));
      assert.equal(result.join(""), expected, JSON.stringify(segments));
      assert.equal(result.length, segments.length);
    }
  });
}

test("source whitespace is preserved without duplicate separators", async () => {
  const result = await contextualReadings(["猫 ", "は"], async () =>
    [token("猫", "ネコ"), token("は", "ワ", "助詞")], async s => romanizeKana(s));
  assert.equal(result.join(""), "neko wa");
});

test("renderer uses new boundaries without mutating original grouping", () => {
  const source = [
    {TransliteratedText: "wata", IsPartOfWord: false, RomanizedIsPartOfWord: true},
    {TransliteratedText: "shi", IsPartOfWord: true, RomanizedIsPartOfWord: false},
    {TransliteratedText: " wa", IsPartOfWord: false, RomanizedIsPartOfWord: false},
  ];
  const rendered = romanizedSegments(source, true);
  assert.deepEqual(rendered.map(s => s.IsPartOfWord), [true, false, false]);
  assert.deepEqual(rendered.map(s => s.TransliteratedText), ["wata", "shi", "wa"]);
  assert.equal(source[2].TransliteratedText, " wa");
  assert.equal(romanizedSegments(source, false), source);
});
