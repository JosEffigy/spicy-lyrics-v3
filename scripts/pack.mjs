import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const version = "7.2.2";
const source = path.resolve(`dist/sakura-lyrics@${version}`);
const output = path.resolve(`sakura-lyrics@${version}.zip`);
const zip = new JSZip();

async function addDirectory(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      await addDirectory(absolute, relative);
    } else {
      zip.file(relative, await readFile(absolute), { date: new Date("1980-01-01T00:00:00Z") });
    }
  }
}

await addDirectory(source);
const bytes = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
  platform: "UNIX",
});
await writeFile(output, bytes);

const checksum = createHash("sha256").update(bytes).digest("hex");
console.log(output);
console.log(`sha256:${checksum}`);
