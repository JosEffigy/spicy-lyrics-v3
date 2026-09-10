import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { contextualReadings, romanizeKana } from "./JapaneseContext.ts";
import { createJapaneseEngine } from "./JapaneseEngine.ts";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const dictionary = new Promise<any>((resolve, reject) => kuromoji.builder({
  dicPath: path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict"),
}).build((error: unknown, tokenizer: any) => error ? reject(error) : resolve(tokenizer)));

const contractions: [string, string][] = [
  ["き", "ky"], ["ぎ", "gy"], ["し", "sh"], ["じ", "j"], ["ち", "ch"],
  ["ぢ", "j"], ["に", "ny"], ["ひ", "hy"], ["び", "by"], ["ぴ", "py"], ["み", "my"], ["り", "ry"],
];
test("all standard contracted sounds survive script and token boundaries", async () => {
  for (const [base, prefix] of contractions) {
    for (const [small, vowel] of [["ゃ", "a"], ["ゅ", "u"], ["ょ", "o"]]) {
      for (const source of [base + small, base + String.fromCodePoint(small.codePointAt(0)! + 0x60),
        Array.from(base + small, c => String.fromCodePoint(c.codePointAt(0)! + 0x60)).join("")]) {
        assert.equal(romanizeKana(source), prefix + vowel, source);
        const segments = Array.from(source);
        const result = await contextualReadings(segments, async () => segments.map(surface_form =>
          ({surface_form, pos: "名詞", reading: surface_form})), async s => romanizeKana(s));
        assert.equal(result.join(""), prefix + vowel, source + " split tokens");
      }
    }
  }
});

test("extended kana, voicing, long vowels, and nasal disambiguation", () => {
  for (const [source, expected] of [
    ["きや", "kiya"], ["きゆ", "kiyu"], ["きよ", "kiyo"],
    ["シェ", "she"], ["チェ", "che"], ["ティ", "ti"], ["ディ", "di"],
    ["トゥ", "tu"], ["ファ", "fa"], ["フィ", "fi"], ["フェ", "fe"], ["フォ", "fo"],
    ["ゔぁ", "va"], ["ヴュ", "vyu"], ["きュ", "kyu"], ["ｷｭ", "kyu"],
    ["か\u3099", "ga"], ["ﾊﾟ", "pa"], ["パーティー", "pātī"],
    ["しんあい", "shin'ai"], ["しんよう", "shin'you"],
    ["くゝ", "kuku"], ["すゞ", "suzu"], ["カヽ", "kaka"], ["スヾ", "suzu"],
  ]) assert.equal(romanizeKana(source), expected, source);
});

test("modifier tokens join even when their dictionary reading expands the small kana", async () => {
  const result = await contextualReadings(["き", "ゅ"], async () => [
    {surface_form: "き", pronunciation: "キ", pos: "名詞"},
    {surface_form: "ゅ", pronunciation: "ユ", pos: "名詞"},
  ], async s => romanizeKana(s));
  assert.equal(result.join(""), "kyu");
});

test("real dictionary handles okurigana, particles, contractions, and normalized timing", async () => {
  const tokenizer = await dictionary;
  const engine = createJapaneseEngine(async text => tokenizer.tokenize(text));
  for (const [source, expected] of [
    ["読むんだ", "yomunda"], ["読んだ", "yonda"], ["食べなかった", "tabenakatta"],
    ["行った", "itta"], ["行う", "okonau"], ["生きる", "ikiru"], ["生まれる", "umareru"],
    ["一ヶ月", "ichikagetsu"], ["時々", "tokidoki"], ["きゅう", "kyuu"],
    ["きゃっと", "kyatto"], ["ｷｭｳ", "kyuu"], ["パーティー", "pātī"],
    ["ﾊﾟｰﾃｨｰ", "pātī"], ["か\u3099", "ga"], ["私を", "watashi o"],
  ]) {
    const variants = [[source], Array.from(source)];
    for (let i = 1; i < source.length; i++) variants.push([source.slice(0, i), source.slice(i)]);
    for (const segments of variants) {
      const result = await engine(segments);
      assert.equal(result.join(""), expected, JSON.stringify(segments));
      assert.equal(result.length, segments.length);
    }
  }
});

test("explicit gaps and independent nouns do not acquire contraction joins", async () => {
  const tokenizer = await dictionary;
  const engine = createJapaneseEngine(async text => tokenizer.tokenize(text));
  assert.equal((await engine(["き ゅ"])).join(""), "ki yu");
  assert.equal((await engine(["猫、犬。"])).join(""), "neko、inu。");
  const result = await contextualReadings(["猫んだ"], async () => [
    {surface_form: "猫", reading: "ネコ", pos: "名詞"},
    {surface_form: "ん", reading: "ン", pos: "名詞", pos_detail_1: "一般"},
    {surface_form: "だ", reading: "ダ", pos: "助動詞"},
  ], async s => romanizeKana(s));
  assert.equal(result.join(""), "neko nda");
});

test("supplied contractions are joined without replacing pronunciation or timing", async () => {
  const tokenizer = await dictionary;
  const engine = createJapaneseEngine(async text => tokenizer.tokenize(text));
  for (const [source, supplied, expected] of [
    ["読むんだ", "yomu nda", "yomunda"], ["行くんだ", "iku n da", "ikunda"],
    ["食べたんだ", "tabeta nda", "tabetanda"], ["読むんです", "yomu n desu", "yomundesu"],
    ["読むんだ", "special nda", "special nda"], ["猫だ", "neko nda", "neko nda"],
  ]) assert.equal((await engine([source], [supplied])).join(""), expected);
  assert.deepEqual(await engine(["読む", "ん", "だ"], ["yomu", " n", " da"]), ["yomu", "n", "da"]);
});
