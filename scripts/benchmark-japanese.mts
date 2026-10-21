import {createRequire} from "node:module";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {createJapaneseResolver} from "../src/utils/Lyrics/JapaneseResolver.ts";
import {tokenizeWithCandidates} from "../src/utils/Lyrics/JapaneseDictionary.ts";
const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const tokenizer: any = await new Promise((resolve, reject) => kuromoji.builder({
  dicPath: path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict"),
}).build((error: unknown, value: any) => error ? reject(error) : resolve(value)));
let calls = 0;
const resolve = createJapaneseResolver(async text => {calls++; return tokenizeWithCandidates(tokenizer, text);});
const lines = [
  ["風が吹く", "fu ga fuku"], ["明日も歩き続ける", ""], ["食べられなかった", ""],
  ["もう我慢ばっかしてらんないよ", ""], ["ﾊﾟｰﾃｨｰで歌う", ""], ["明日", "asu"],
];
for (const [text, supplied] of lines) await resolve([text], {supplied: supplied ? [supplied] : []});
const batches: number[] = [];
let characters = 0;
for (let batch = 0; batch < 5; batch++) {
  const started = performance.now();
  for (let i = 0; i < 1000; i++) {
    const [text, supplied] = lines[i % lines.length];
    const result = await resolve([text], {supplied: supplied ? [supplied] : []});
    characters += result.segments.join("").length;
  }
  batches.push((performance.now() - started) / 1000);
}
console.log(JSON.stringify({warmMedianMs: batches.sort((a,b) => a-b)[2], analyzerCalls: calls, characters}));
