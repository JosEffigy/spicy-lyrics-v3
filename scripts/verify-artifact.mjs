import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const version = "7.2.3";
const artifact = process.argv[2] ?? `sakura-lyrics@${version}.zip`;
const bytes = await readFile(artifact);
const zip = await JSZip.loadAsync(bytes);
if (Object.keys(zip.files).some(name => name.endsWith(".map"))) {
  throw new Error("Release archive must not contain debug source maps");
}
const required = ["index.js", "index.css", "metadata.json", "spicetify-module.json"];

for (const name of required) {
  if (!zip.file(name)) throw new Error(`Artifact is missing ${name}`);
}

const metadata = JSON.parse(await zip.file("metadata.json").async("string"));
if (metadata.name !== "sakura-lyrics" || metadata.version !== version) {
  throw new Error("Artifact metadata does not match the requested module version");
}

console.log(`verified ${required.length} required files`);
console.log(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
