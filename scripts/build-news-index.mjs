import { mkdir, writeFile } from "node:fs/promises";

const ENERGY_QUERY = "electricity OR power OR energy OR solar OR wind OR oil OR gas OR nuclear OR grid OR meter OR كهرباء OR الطاقة OR النفط OR الغاز OR عداد";
const REGIONS = [
  ["egypt", "Egypt", "مصر"],
  ["saudi arabia", "Saudi Arabia", "السعودية"],
  ["UAE", "UAE OR United Arab Emirates", "الإمارات"],
  ["iraq", "Iraq", "العراق"],
  ["iran", "Iran", "إيران"],
  ["libya", "Libya", "ليبيا"],
  ["algeria", "Algeria", "الجزائر"],
  ["morocco", "Morocco", "المغرب"],
  ["jordan", "Jordan", "الأردن"],
  ["kuwait", "Kuwait", "الكويت"],
  ["qatar", "Qatar", "قطر"],
  ["turkey", "Turkey", "تركيا"],
];

const FEEDS = [
  {
    query: `(${ENERGY_QUERY}) (MENA OR "Middle East" OR "North Africa" OR الخليج OR "الشرق الأوسط")`,
    regions: [],
    locale: "en",
  },
  {
    query: "(الكهرباء OR الطاقة OR النفط OR الغاز OR العدادات الذكية) (مصر OR الخليج OR الشرق الأوسط OR شمال أفريقيا)",
    regions: [],
    locale: "ar",
  },
  {
    query: "(smart meter OR prepaid meter OR AMI OR electricity meter OR عداد الكهرباء OR العدادات الذكية) (MENA OR Egypt OR Gulf OR مصر OR الخليج)",
    regions: [],
    locale: "en",
  },
  ...REGIONS.map(([key, english, arabic]) => ({
    query: `(${ENERGY_QUERY}) (${english} OR ${arabic})`,
    regions: [key],
    locale: /[\u0600-\u06ff]/.test(arabic) ? "ar" : "en",
  })),
];

function feedUrl(feed) {
  const arabic = feed.locale === "ar";
  const params = new URLSearchParams({
    q: feed.query,
    hl: arabic ? "ar" : "en-US",
    gl: arabic ? "EG" : "US",
    ceid: arabic ? "EG:ar" : "US:en",
  });
  return `https://news.google.com/rss/search?${params}`;
}

function decodeXml(value = "") {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function cleanText(value = "") {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readSource(itemXml) {
  const match = itemXml.match(/<source(?:\s+url="([^"]*)")?>([\s\S]*?)<\/source>/i);
  return {
    name: match ? cleanText(match[2]) : "Google News",
    url: match && match[1] ? decodeXml(match[1]) : "https://news.google.com",
  };
}

function parseFeed(xml, feed) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.map((itemXml) => {
    const published = new Date(tagValue(itemXml, "pubDate"));
    const description = cleanText(tagValue(itemXml, "description"));
    return {
      title: cleanText(tagValue(itemXml, "title")),
      description,
      content: `${feed.query} ${description}`,
      url: tagValue(itemXml, "link") || tagValue(itemXml, "guid"),
      image: "",
      publishedAt: Number.isNaN(published.getTime()) ? "" : published.toISOString(),
      source: readSource(itemXml),
      provider: "Scheduled Google News index",
      regions: feed.regions,
    };
  }).filter((article) => article.title && article.url && article.publishedAt);
}

function articleKey(article) {
  return `${article.title.toLowerCase()}|${article.source.name.toLowerCase()}`;
}

const collected = new Map();
let successfulFeeds = 0;

for (const feed of FEEDS) {
  try {
    const response = await fetch(feedUrl(feed), {
      headers: { "user-agent": "Power-News-Indexer/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Keep each geography represented instead of letting the broadest feeds
    // crowd smaller markets out of the final index.
    const articles = parseFeed(await response.text(), feed).slice(0, 60);
    for (const article of articles) {
      const key = articleKey(article);
      const existing = collected.get(key);
      if (existing) {
        existing.regions = [...new Set([...existing.regions, ...article.regions])];
      } else {
        collected.set(key, article);
      }
    }
    successfulFeeds += 1;
  } catch (error) {
    console.warn(`Feed failed: ${feed.query.slice(0, 80)} — ${error.message}`);
  }
}

if (!successfulFeeds) throw new Error("All scheduled news feeds failed.");

const cutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
const articles = [...collected.values()]
  .filter((article) => new Date(article.publishedAt).getTime() >= cutoff)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 1000);

const output = {
  generatedAt: new Date().toISOString(),
  successfulFeeds,
  totalFeeds: FEEDS.length,
  articles,
};

await mkdir("data", { recursive: true });
await writeFile("data/news.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${articles.length} articles from ${successfulFeeds}/${FEEDS.length} feeds.`);
