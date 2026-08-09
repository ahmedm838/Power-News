import fs from "node:fs/promises";
import path from "node:path";

const ALMAL_BASE = "https://almalnews.com";
const TAGS = [
  "\u0648\u0632\u0627\u0631\u0629-\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
  "\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
  "\u0637\u0627\u0642\u0629",
  "\u0648\u0632\u064a\u0631-\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
  "\u0627\u0644\u0634\u0628\u0643\u0629-\u0627\u0644\u0642\u0648\u0645\u064a\u0629-\u0644\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
  "\u0627\u0644\u0642\u0627\u0628\u0636\u0629-\u0644\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
  "\u0627\u0644\u0642\u0627\u0628\u0636\u0629-\u0644\u0643\u0647\u0631\u0628\u0627\u0621-\u0645\u0635\u0631",
  "\u0639\u062f\u0627\u062f\u0627\u062a-\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
  "\u0627\u0644\u0637\u0627\u0642\u0629-\u0627\u0644\u0645\u062a\u062c\u062f\u062f\u0629"
];

const MAX_LIST_PAGES = 3;
const MAX_ARTICLES = 80;

const headers = { "user-agent": "Mozilla/5.0 Power-News indexer" };

function decodeHtml(value = "") {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readMeta(html, key) {
  const prop = new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']*)["']`, "i").exec(html);
  const name = new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']*)["']`, "i").exec(html);
  return decodeHtml((prop || name || [])[1] || "");
}

function cleanTitle(title) {
  return title.replace(/\s*-?\s*\u062c\u0631\u064a\u062f\u0629 \u0627\u0644\u0645\u0627\u0644\s*$/i, "").trim();
}

async function fetchText(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

function extractUrls(html) {
  return [...new Set(html.match(/https:\/\/almalnews\.com\/\d+\/[^"'<>\s]+\/?/g) || [])]
    .map((url) => url.split("?")[0].split("#")[0]);
}

async function readArticle(url) {
  const html = await fetchText(url);
  const title = cleanTitle(readMeta(html, "og:title"));
  const description = readMeta(html, "description") || readMeta(html, "og:description");
  const image = readMeta(html, "og:image");
  const publishedAt = (readMeta(html, "article:published_time") || "").replace(/\s+\+(\d{2}):?(\d{2})$/, "+$1:$2");
  const keywords = [...html.matchAll(/<meta[^>]+(?:name=["']keywords["']|property=["']article:tag["'])[^>]+content=["']([^"']*)["']/gi)]
    .map((match) => decodeHtml(match[1]))
    .join(",");

  if (!title || !publishedAt) return null;

  return {
    title,
    description,
    content: "\u0645\u0635\u0631 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0642\u0648\u0645\u064a\u0629",
    keywords,
    url,
    image,
    publishedAt,
    sourceName: "\u062c\u0631\u064a\u062f\u0629 \u0627\u0644\u0645\u0627\u0644"
  };
}

const seen = new Set();
const urls = [];

for (const tag of TAGS) {
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const html = await fetchText(`${ALMAL_BASE}/tag/${encodeURIComponent(tag)}/${page}/`);
    for (const url of extractUrls(html)) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }
}

const articles = [];
for (const url of urls.slice(0, MAX_ARTICLES)) {
  try {
    const article = await readArticle(url);
    if (article) articles.push(article);
  } catch (error) {
    console.warn(error.message);
  }
}

articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

await fs.mkdir("data", { recursive: true });
await fs.writeFile(
  path.join("data", "almalnews.json"),
  `${JSON.stringify({ updatedAt: new Date().toISOString(), source: "almalnews.com", articles }, null, 2)}\n`
);

console.log(`Wrote ${articles.length} Al Mal articles`);
