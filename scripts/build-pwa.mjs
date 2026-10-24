import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { relative, join, sep } from "node:path";

const root = new URL("../dist/", import.meta.url);
const base = fileURLToPath(root);
const urls = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => "/" + relative(base, join(entry.parentPath, entry.name)).split(sep).join("/"))
  .filter((url) => url !== "/sw.js" && !url.endsWith(".map"))
  .sort();
const template = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const hash = createHash("sha256").update(template);
for (const url of urls) {
  hash.update(url).update(await readFile(new URL(url.slice(1), root)));
}
const worker = template
  .replace("__BUILD_ID__", hash.digest("hex").slice(0, 16))
  .replace("__PRECACHE_URLS__", JSON.stringify(urls));
await writeFile(new URL("sw.js", root), worker);
console.log(`PWA: precaching ${urls.length} app files.`);
