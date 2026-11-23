import { mkdir, readFile, writeFile } from "node:fs/promises";
import { COUNTRIES, evaluateArticle, dedupeKey } from "./lib/mena-relevance.mjs";

// ─────────────────────────────────────────────────────────────────────────────
//  MENA power & energy news indexer
//
//  Pulls Google News RSS searches (Arabic, English, French) plus a few direct
//  RSS feeds, keeps only articles that are BOTH power/energy-sector AND about
//  a MENA country (see scripts/lib/mena-relevance.mjs), de-duplicates
//  syndicated copies, and writes data/news.json.
// ─────────────────────────────────────────────────────────────────────────────

const FRESHNESS = "when:7d"; // Google News operator: only items from the last 7 days
const CONFLICT_EXCLUSIONS = "-war -missile -military -airstrike -حرب -صواريخ -عسكري -غارة -قصف";

const POWER_AR = `(الكهرباء OR "محطة توليد" OR "شبكة الكهرباء" OR "الطاقة المتجددة" OR "الطاقة الشمسية" OR "طاقة الرياح" OR "عدادات الكهرباء" OR "الربط الكهربائي" OR "تخزين الطاقة")`;
const POWER_EN = `(electricity OR "power plant" OR "power grid" OR "renewable energy" OR "solar" OR "wind farm" OR "battery storage" OR "smart meter" OR interconnection OR "green hydrogen")`;
const POWER_FR = `(électricité OR "centrale solaire" OR "énergies renouvelables" OR "parc éolien" OR "réseau électrique" OR compteurs OR "hydrogène vert")`;
const OILGAS_EN = `("oil production" OR "gas production" OR "gas field" OR refinery OR LNG OR pipeline OR "oil discovery")`;
const OILGAS_AR = `("إنتاج النفط" OR "إنتاج الغاز" OR "حقل غاز" OR "حقل نفط" OR مصفاة OR "الغاز المسال" OR "اكتشاف")`;

// English search name per country key (Arabic names come from COUNTRIES).
const EN_NAMES = {
  "egypt": "Egypt", "saudi arabia": "Saudi", "UAE": "(UAE OR \"Abu Dhabi\" OR Dubai)",
  "iraq": "Iraq", "iran": "Iran", "libya": "Libya", "algeria": "Algeria", "morocco": "Morocco",
  "tunisia": "Tunisia", "jordan": "Jordan", "kuwait": "Kuwait", "qatar": "Qatar", "oman": "Oman",
  "bahrain": "Bahrain", "lebanon": "Lebanon", "syria": "Syria", "palestine": "(Palestine OR Gaza OR \"West Bank\")",
  "israel": "Israel", "yemen": "Yemen", "sudan": "Sudan", "mauritania": "Mauritania", "turkey": "Turkey",
};
const AR_QUERY_NAMES = { "UAE": "(الإمارات OR أبوظبي OR دبي)", "oman": "\"سلطنة عمان\"", "saudi arabia": "(السعودية OR المملكة)" };
const FR_NAMES = { "morocco": "Maroc", "algeria": "Algérie", "tunisia": "Tunisie", "mauritania": "Mauritanie", "lebanon": "Liban" };
// Arabic Google News editions that exist; others fall back to Egypt's.
const AR_EDITIONS = { "egypt": "EG", "saudi arabia": "SA", "UAE": "AE", "lebanon": "LB" };
const OILGAS_COUNTRIES = ["egypt", "saudi arabia", "UAE", "iraq", "algeria", "libya", "qatar", "kuwait", "oman"];

// [domain, locale, home country key ("" = pan-regional), optional direct RSS URL]
// The home country lets a local outlet's domestic story count as that country
// even when the text never names it.
const PREFERRED_SITES = [
  // Egypt
  ["almalnews.com", "ar", "egypt"],
  ["alborsaanews.com", "ar", "egypt"],
  ["amwalalghad.com", "en", "egypt"],
  ["egypttoday.com", "en", "egypt"],
  ["gate.ahram.org.eg", "ar", "egypt"],
  ["english.ahram.org.eg", "en", "egypt"],
  ["egelectricgate.com", "ar", "egypt", "https://www.egelectricgate.com/?feed=rss2"],
  ["masrawy.com", "ar", "egypt"],
  ["youm7.com", "ar", "egypt"],
  ["almasryalyoum.com", "ar", "egypt"],
  ["powernews.cc", "ar", "egypt"],
  ["economyplusme.com", "ar", "egypt"],
  ["enterprise.press", "en", "egypt"],
  ["dailynewsegypt.com", "en", "egypt"],
  ["egyptoil-gas.com", "en", "egypt"],
  // Saudi Arabia
  ["argaam.com", "ar", "saudi arabia"],
  ["maal.com", "ar", "saudi arabia"],
  ["arabnews.com", "en", "saudi arabia"],
  ["aleqt.com", "ar", "saudi arabia"],
  ["spa.gov.sa", "ar", "saudi arabia"],
  ["taqanews.com", "ar", ""],
  // UAE
  ["wam.ae", "ar", "UAE"],
  ["albayan.ae", "ar", "UAE"],
  ["emaratalyoum.com", "ar", "UAE"],
  ["alkhaleej.ae", "ar", "UAE"],
  ["thenationalnews.com", "en", "UAE"],
  ["gulfnews.com", "en", "UAE"],
  ["khaleejtimes.com", "en", "UAE"],
  // Rest of the Gulf
  ["alanba.com.kw", "ar", "kuwait"],
  ["kuna.net.kw", "ar", "kuwait"],
  ["thepeninsulaqatar.com", "en", "qatar"],
  ["qna.org.qa", "ar", "qatar"],
  ["alwatan.com", "ar", ""],
  ["omanobserver.om", "en", "oman"],
  ["timesofoman.com", "en", "oman"],
  ["gdnonline.com", "en", "bahrain"],
  // Levant / Iraq
  ["alghad.com", "ar", "jordan"],
  ["jordantimes.com", "en", "jordan"],
  ["shafaq.com", "ar", "iraq"],
  ["ina.iq", "ar", "iraq"],
  ["rudaw.net", "en", "iraq"],
  // North Africa
  ["hespress.com", "ar", "morocco"],
  ["moroccoworldnews.com", "en", "morocco"],
  ["le360.ma", "fr", "morocco"],
  ["lematin.ma", "fr", "morocco"],
  ["algerie-eco.com", "fr", "algeria"],
  ["aps.dz", "fr", "algeria"],
  ["lapresse.tn", "fr", "tunisia"],
  ["ilboursa.com", "fr", "tunisia"],
  ["libyaobserver.ly", "en", "libya"],
  // Pan-regional energy & business outlets
  ["attaqa.net", "ar", ""],
  ["solarabic.com", "ar", ""],
  ["utilities-me.com", "en", ""],
  ["ognnews.com", "en", ""],
  ["mees.com", "en", ""],
  ["meed.com", "en", ""],
  ["agbi.com", "en", ""],
  ["zawya.com", "en", ""],
  ["constructionweekonline.com", "en", ""],
  ["asharqbusiness.com", "ar", ""],
  ["aawsat.com", "ar", ""],
  ["arabic.cnn.com", "ar", ""],
  ["alarabiya.net", "ar", ""],
];

const SITE_QUERY = {
  ar: `(الكهرباء OR "محطة توليد" OR "الطاقة المتجددة" OR "الطاقة الشمسية" OR "طاقة الرياح" OR عدادات OR النفط OR الغاز)`,
  en: `(electricity OR "power plant" OR grid OR renewable OR solar OR wind OR meter OR oil OR gas OR LNG)`,
  fr: `(électricité OR centrale OR renouvelables OR solaire OR éolien OR compteurs OR pétrole OR gaz)`,
};

const FEEDS = [
  // Region-wide
  { query: `${POWER_EN} ("Middle East" OR MENA OR "North Africa" OR GCC OR "Gulf states") ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "en" },
  { query: `${POWER_AR} ("الشرق الأوسط" OR الخليج OR "شمال أفريقيا" OR "الدول العربية") ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "ar" },
  { query: `${OILGAS_EN} ("Middle East" OR MENA OR "North Africa" OR GCC) ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "en" },
  { query: `${OILGAS_AR} ("الشرق الأوسط" OR الخليج OR "شمال أفريقيا") ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "ar" },
  // Metering (core interest) and the region's big utilities/developers
  { query: `("smart meter" OR "prepaid meter" OR "smart metering" OR AMI) (Egypt OR Saudi OR UAE OR Iraq OR Gulf OR MENA OR Morocco OR Jordan) ${FRESHNESS}`, locale: "en" },
  { query: `("عدادات ذكية" OR "العدادات الذكية" OR "عدادات مسبقة الدفع" OR "العداد الكودي" OR "عدادات الكهرباء") ${FRESHNESS}`, locale: "ar" },
  { query: `("ACWA Power" OR Masdar OR "Saudi Electricity" OR DEWA OR EWEC OR KAHRAMAA OR Sonelgaz OR STEG OR ONEE OR EEHC OR NEPCO OR "Nebras Power" OR "Elsewedy") ${FRESHNESS}`, locale: "en" },
  { query: `("أكوا باور" OR "السعودية للكهرباء" OR "هيئة كهرباء ومياه دبي" OR "القابضة لكهرباء مصر" OR سونلغاز OR كهرماء OR "الربط الكهربائي" OR "السويدي إليكتريك") ${FRESHNESS}`, locale: "ar" },

  // Every MENA country, in Arabic and English (power), plus oil & gas for producers
  ...Object.entries(COUNTRIES).flatMap(([key, c]) => {
    const feeds = [
      { query: `${POWER_AR} ${AR_QUERY_NAMES[key] || c.ar} ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "ar", edition: AR_EDITIONS[key] || "EG" },
      { query: `${POWER_EN} ${EN_NAMES[key] || c.label} ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "en" },
    ];
    if (OILGAS_COUNTRIES.includes(key)) {
      feeds.push({ query: `${OILGAS_EN} ${EN_NAMES[key] || c.label} ${FRESHNESS} ${CONFLICT_EXCLUSIONS}`, locale: "en" });
    }
    if (FR_NAMES[key]) {
      feeds.push({ query: `${POWER_FR} ${FR_NAMES[key]} ${FRESHNESS}`, locale: "fr" });
    }
    return feeds;
  }),

  // One feed per listed website so smaller outlets are always covered
  ...PREFERRED_SITES.map(([site, locale, country, directUrl]) => ({
    query: `${SITE_QUERY[locale]} site:${site} ${FRESHNESS}`,
    locale,
    site,
    siteCountry: country,
    directUrl: directUrl || "",
    limit: 40,
  })),
];

function feedUrl(feed, edition) {
  if (feed.directUrl) return feed.directUrl;
  const settings = {
    ar: { hl: "ar", gl: edition || "EG", ceid: `${edition || "EG"}:ar` },
    fr: { hl: "fr", gl: "FR", ceid: "FR:fr" },
    en: { hl: "en-US", gl: "US", ceid: "US:en" },
  }[feed.locale];
  return `https://news.google.com/rss/search?${new URLSearchParams({ q: feed.query, ...settings })}`;
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
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function cleanText(value = "") {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function readSource(itemXml, feed) {
  if (feed.directUrl && feed.site === "egelectricgate.com") {
    return { name: "بوابة أخبار كهرباء مصر", url: "https://www.egelectricgate.com/" };
  }
  const match = itemXml.match(/<source(?:\s+url="([^"]*)")?>([\s\S]*?)<\/source>/i);
  return {
    name: match ? cleanText(match[2]) : (feed.site || "Google News"),
    url: match && match[1] ? decodeXml(match[1]) : (feed.site ? `https://${feed.site}` : "https://news.google.com"),
  };
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

const siteMatches = (host, site) => !!host && (host === site || host.endsWith(`.${site}`));

// Google's site: operator is loose and sometimes returns other outlets, so a
// "preferred site" label is only kept when the publisher's domain really matches.
function verifiedSite(article) {
  const host = hostOf(article.source && article.source.url);
  if (article.preferredSite && siteMatches(host, article.preferredSite)) return article.preferredSite;
  const match = PREFERRED_SITES.find(([site]) => siteMatches(host, site));
  return match ? match[0] : "";
}

function siteCountryFor(site) {
  const match = PREFERRED_SITES.find(([domain]) => domain === site);
  return match ? match[2] : "";
}

function finalize(article) {
  article.preferredSite = verifiedSite(article);
  const verdict = evaluateArticle(article, siteCountryFor(article.preferredSite));
  if (!verdict.keep) return null;
  article.regions = verdict.regions;
  article.topic = verdict.topic;
  return article;
}

function parseFeed(xml, feed) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.map((itemXml) => {
    const published = new Date(tagValue(itemXml, "pubDate"));
    const description = cleanText(tagValue(itemXml, "description"));
    return {
      title: cleanText(tagValue(itemXml, "title")),
      description,
      content: description,
      url: tagValue(itemXml, "link") || tagValue(itemXml, "guid"),
      image: "",
      publishedAt: Number.isNaN(published.getTime()) ? "" : published.toISOString(),
      source: readSource(itemXml, feed),
      provider: "Scheduled Google News index",
      regions: [],
      topic: "",
      preferredSite: feed.site || "",
    };
  }).filter((article) => article.title && article.url && article.publishedAt)
    .map(finalize)
    .filter(Boolean);
}

// ── Collect (keeping previous coverage across feed outages) ───────────────────
const collected = new Map();
function add(article) {
  const key = dedupeKey(article);
  if (!key) return;
  const existing = collected.get(key);
  if (!existing) { collected.set(key, article); return; }
  // Same story syndicated by several outlets: keep the copy from a listed
  // website if there is one, otherwise the earliest report.
  const better = (!existing.preferredSite && article.preferredSite) ||
    (!!existing.preferredSite === !!article.preferredSite && article.publishedAt < existing.publishedAt);
  collected.set(key, better ? article : existing);
}

try {
  const previous = JSON.parse(await readFile("data/news.json", "utf8"));
  for (const article of previous.articles || []) {
    if (article.title && article.url && article.publishedAt) {
      article.regions = [];
      const kept = finalize(article); // re-check old items against the current rules
      if (kept) add(kept);
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Power-News-Indexer/3.0)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  if (!/<rss[\s>]/i.test(xml)) throw new Error("Invalid RSS response");
  return xml;
}

async function fetchFeed(feed) {
  const urls = [feedUrl(feed, feed.edition)];
  if (feed.locale === "ar" && feed.edition && feed.edition !== "EG") urls.push(feedUrl(feed, "EG"));
  let lastError;
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await fetchText(url);
      } catch (error) {
        lastError = error;
        if (/HTTP 4\d\d/.test(error.message) && !/HTTP 429/.test(error.message)) break; // try next edition
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

let successfulFeeds = 0;
const failures = [];
for (const feed of FEEDS) {
  try {
    const xml = await fetchFeed(feed);
    parseFeed(xml, feed).slice(0, feed.limit || 60).forEach(add);
    successfulFeeds += 1;
  } catch (error) {
    failures.push(feed.site || feed.query.slice(0, 60));
    console.warn(`Feed failed: ${feed.site || feed.query.slice(0, 80)} — ${error.message}`);
  }
  await sleep(600); // be polite to Google News; ~110 requests per run
}

if (!successfulFeeds) throw new Error("All scheduled news feeds failed.");

const cutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
const articles = [...collected.values()]
  .filter((article) => new Date(article.publishedAt).getTime() >= cutoff)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 1500);

const byRegion = {};
for (const article of articles) for (const region of article.regions) byRegion[region] = (byRegion[region] || 0) + 1;

const output = {
  generatedAt: new Date().toISOString(),
  successfulFeeds,
  totalFeeds: FEEDS.length,
  failedFeeds: FEEDS.length - successfulFeeds,
  byRegion,
  articles,
};

await mkdir("data", { recursive: true });
await writeFile("data/news.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${articles.length} articles from ${successfulFeeds}/${FEEDS.length} feeds.`);
console.log("By region:", JSON.stringify(byRegion));
if (failures.length) console.log(`Failed feeds (${failures.length}):`, failures.join(", "));
