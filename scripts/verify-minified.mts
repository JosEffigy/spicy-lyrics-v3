import {build} from "esbuild";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
import {createJapaneseResolver} from "../src/utils/Lyrics/JapaneseResolver.ts";
import {tokenizeWithCandidates} from "../src/utils/Lyrics/JapaneseDictionary.ts";
const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const tokenizer: any = await new Promise((resolve, reject) => kuromoji.builder({
  dicPath: path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict"),
}).build((error: unknown, value: any) => error ? reject(error) : resolve(value)));
const temporary = await mkdtemp(path.join(tmpdir(), "sakura-minified-"));
try {
  const outfile = path.join(temporary, "resolver.cjs");
  await build({entryPoints: ["src/utils/Lyrics/JapaneseResolver.ts"], outfile,
    bundle: true, minify: true, platform: "node", format: "cjs", target: "es2022"});
  const minified = require(outfile).createJapaneseResolver(async (text: string) => tokenizeWithCandidates(tokenizer, text));
  const original = createJapaneseResolver(async text => tokenizeWithCandidates(tokenizer, text));
  let checked = 0;
  for (const text of ["明日", "風が吹く", "食べられなかった", "してらんない", "ﾊﾟｰﾃｨｰ", "𠮷"]) {
    const variants = [[text], Array.from(text)];
    for (let i = 1; i < text.length; i++) variants.push([text.slice(0, i), text.slice(i)]);
    for (const segments of variants) {
      for (const options of [{}, {supplied: segments.map(() => "fu")}, {source: "direct" as const, supplied: segments.map(() => "fu")}]) {
        assert.deepEqual(await minified(segments, options), await original(segments, options));
        checked++;
      }
    }
  }
  console.log("Minified resolver matches source in " + checked + " cases");
} finally {
  // Only the exact directory created above is removed.
  await rm(temporary, {recursive: true, force: true});
}
