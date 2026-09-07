import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const version = "7.0.0-beta.3";
const artifact = `spicy-lyrics@${version}.zip`;
const bytes = await readFile(artifact);
const zip = await JSZip.loadAsync(bytes);
const required = ["index.js", "index.css", "metadata.json", "spicetify-module.json"];

for (const name of required) {
  if (!zip.file(name)) throw new Error(`Artifact is missing ${name}`);
}

const metadata = JSON.parse(await zip.file("metadata.json").async("string"));
if (metadata.name !== "spicy-lyrics" || metadata.version !== version) {
  throw new Error("Artifact metadata does not match the requested module version");
}

console.log(`verified ${required.length} required files`);
console.log(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
