import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));

const bundle={
  products:read("data/products.json"),
  articles:read("data/articles.json"),
  categories:read("data/categories.json"),
  siteCopy:read("data/site-copy.json"),
  monetization:read("data/monetization.json")
};

const bundleText = `window.__CTK_DATA__ = ${JSON.stringify(bundle)};\n`;

fs.writeFileSync(
  path.join(root, "data", "content-data.js"),
  bundleText,
  "utf8"
);

console.log(`Generated data/content-data.js with ${bundle.products.length} products and ${bundle.articles.length} articles.`);
