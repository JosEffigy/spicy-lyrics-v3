import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import path from "node:path";
import {createJapaneseResolver} from "./JapaneseResolver.ts";
import {tokenizeWithCandidates} from "./JapaneseDictionary.ts";
import {analyzeJapaneseText, projectJapanesePlan, romanizeKana} from "./JapaneseContext.ts";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const dictionary = new Promise<any>((resolve, reject) => kuromoji.builder({
  dicPath: path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict"),
}).build((error: unknown, tokenizer: any) => error ? reject(error) : resolve(tokenizer)));

test("actual dictionary candidates retain lexical alternatives", async () => {
  const tokenizer = await dictionary;
  const tokens = tokenizeWithCandidates(tokenizer, "明日");
  assert.ok(tokens[0].reading_candidates!.length > 1, JSON.stringify(tokens));
  const resolve = createJapaneseResolver(async text => tokenizeWithCandidates(tokenizer, text));
  const result = await resolve(["明", "日"], {supplied: ["a", "su"]});
  assert.equal(result.segments.join(""), "asu");
  assert.equal(result.outputSource, "supported-provider");
  assert.equal(result.words[0].selectedBy, "supplied-dictionary-match");
  assert.ok(result.words[0].ambiguous);
});

test("reading policy and evidence are independent of all timing splits", async () => {
  const tokenizer = await dictionary;
  const resolve = createJapaneseResolver(async text => tokenizeWithCandidates(tokenizer, text));
  const cases = [
    ["風が吹く", "fu ga fuku", "kaze ga fuku"],
    ["生まれる", "sei mareru", "umareru"],
    ["食べられなかった", "", "taberarenakatta"],
    ["読み続ける", "", "yomitsuzukeru"],
    ["食べ始めた", "", "tabehajimeta"],
    ["静かな夜", "", "shizukana yoru"],
    ["ﾊﾟｰﾃｨｰ", "", "pātī"],
  ];
  for (const [source, supplied, expected] of cases) {
    const full = await resolve([source], {supplied: supplied ? [supplied] : []});
    assert.equal(full.segments.join(""), expected, source);
    for (let cut = 1; cut < source.length; cut++) {
      // Deliberately vary the provider split independently of source timing.
      const midpoint = Math.max(1, Math.floor(supplied.length / 2));
      const result = await resolve([source.slice(0, cut), source.slice(cut)], {
        supplied: supplied ? [supplied.slice(0, midpoint), supplied.slice(midpoint)] : [],
      });
      assert.equal(result.segments.join(""), expected, source + " split " + cut);
      assert.deepEqual(result.words, full.words);
      assert.equal(result.segments.length, 2);
    }
  }
});

test("annotation spans are validated and do not leak into cached analysis", async () => {
  const resolve = createJapaneseResolver(async () => [{surface_form: "明日", reading: "アシタ", pos: "名詞"}]);
  const result = await resolve(["明", "日"], {annotations: [{start: 0, end: 2, text: "明日", kana: "アス"}]});
  assert.equal(result.segments.join(""), "asu");
  assert.equal(result.words[0].selectedBy, "annotation");
  assert.equal((await resolve(["明日"])).segments.join(""), "ashita");
  const bad = await resolve(["明日"], {annotations: [
    {start: 0, end: 2, text: "昨日", kana: "キノウ"},
    {start: 0, end: 1, text: "明", kana: "wrong"},
    null as any,
  ]});
  assert.equal(bad.segments.join(""), "ashita");
  assert.equal(bad.issues.filter(s => s === "annotation-rejected").length, 3);
});

test("unknown kanji stays visible; supplied fallback is explicitly marked unaligned", async () => {
  const resolve = createJapaneseResolver(async text => [{surface_form: text, word_type: "UNKNOWN"}]);
  const plain = await resolve(["𠮷"]);
  assert.equal(plain.segments.join(""), "𠮷");
  assert.equal(plain.words[0].selectedBy, "unresolved");
  const supplied = await resolve(["𠮷"], {supplied: ["yoshi"]});
  assert.equal(supplied.segments.join(""), "yoshi");
  assert.equal(supplied.outputSource, "provider-fallback");
  assert.ok(supplied.issues.includes("supplied-output-not-word-aligned"));
});

test("direct readings retain their declared priority without claiming dictionary support", async () => {
  const resolve = createJapaneseResolver(async () => [{surface_form: "宇宙", reading: "ウチュウ"}]);
  const direct = await resolve(["宇宙"], {supplied: ["sora"], source: "direct"});
  assert.equal(direct.segments.join(""), "sora");
  assert.equal(direct.outputSource, "direct");
  assert.ok(direct.issues.includes("supplied-reading-disagrees"));
});

test("dictionary internals are optional and bad output is recoverable", async () => {
  assert.deepEqual(tokenizeWithCandidates({tokenize: () => [{surface_form: "猫", word_type: "KNOWN"}]}, "猫")
    [0].reading_candidates, []);
  const resolve = createJapaneseResolver(async () => [{surface_form: "unrelated"}]);
  const result = await resolve(["猫"], {supplied: ["neko"]});
  assert.equal(result.segments.join(""), "neko");
  assert.ok(result.issues.includes("analyzer-unavailable-or-misaligned"));
});

test("normalized source offsets still refer to original UTF-16 text", async () => {
  const tokenizer = await dictionary;
  const plan = await analyzeJapaneseText("ﾊﾟｰﾃｨｰで歌う", async text => tokenizeWithCandidates(tokenizer, text));
  for (const word of plan.words) assert.equal(plan.source.slice(word.start, word.end), word.text);
  const segments = Array.from(plan.source);
  const result = await projectJapanesePlan(plan, segments, async s => romanizeKana(s));
  assert.equal(result.join(""), "pātī de utau");
  await assert.rejects(projectJapanesePlan(plan, ["unrelated"], async s => s));
});

test("partial analyzer coverage cannot masquerade as a complete reading", async () => {
  const resolve = createJapaneseResolver(async () => [{surface_form: "猫", reading: "ネコ"}]);
  const result = await resolve(["猫と犬"], {supplied: ["neko to inu"]});
  assert.equal(result.segments.join(""), "neko to inu");
  assert.ok(result.issues.includes("analyzer-unavailable-or-misaligned"));
});

test("proper-name fallback and kana evidence are distinguished", async () => {
  const name = createJapaneseResolver(async text => [{surface_form: text, reading: "ミク", pos: "名詞", pos_detail_1: "固有名詞"}]);
  const result = await name(["未来"], {supplied: ["mirai"]});
  assert.equal(result.outputSource, "provider-fallback");
  assert.equal(result.segments.join(""), "mirai");
  const kana = createJapaneseResolver(async text => [{surface_form: text}]);
  assert.equal((await kana(["きゅ"])).words[0].selectedBy, "literal-kana");
});

test("returned diagnostics cannot mutate cached candidates or grammatical parts", async () => {
  const resolve = createJapaneseResolver(async () => [{surface_form: "明日", reading: "アシタ", reading_candidates: ["アス"]}]);
  const result = await resolve(["明日"]);
  result.words[0].candidates[0] = "broken";
  result.words[0].parts[0].alternatives[0] = "broken";
  result.words[0].parts[0].kana = "broken";
  const next = await resolve(["明日"]);
  assert.equal(next.segments.join(""), "ashita");
  assert.equal(next.words[0].parts[0].kana, "アシタ");
  assert.ok(!next.words[0].candidates.includes("broken"));
  assert.ok(!next.words[0].parts[0].alternatives.includes("broken"));
});
