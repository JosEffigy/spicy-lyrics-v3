import {build} from "esbuild";
import {readFile, stat} from "node:fs/promises";
import path from "node:path";

const metadata = JSON.parse(await readFile(new URL("../metadata.json", import.meta.url), "utf8"));
const directory = path.resolve("dist", metadata.name + "@" + metadata.version);
const entries = ["index.js", "index.css"].map(name => path.join(directory, name));
const before = await Promise.all(entries.map(async file => (await stat(file)).size));
// No property mangling: payload keys and Spicetify APIs are contracts.
// Maps remain local; linked license notices ship with the release.
await build({
  entryPoints: entries, outdir: directory, allowOverwrite: true,
  bundle: false, minify: true, sourcemap: "external", legalComments: "linked",
  target: "es2022", charset: "utf8",
});
for (let i = 0; i < entries.length; i++) {
  const after = (await stat(entries[i])).size;
  console.log(path.basename(entries[i]) + ": " + before[i] + " -> " + after + " bytes");
}
