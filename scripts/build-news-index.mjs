import { mkdir, writeFile } from "node:fs/promises";

const ENERGY_QUERY = "\"electricity grid\" OR \"power grid\" OR \"power plant\" OR \"power generation\" OR \"renewable energy\" OR \"solar power\" OR \"wind power\" OR \"smart meter\" OR \"electricity meter\" OR \"oil production\" OR \"gas production\" OR refinery OR pipeline OR LNG OR الكهرباء OR \"شبكة الكهرباء\" OR \"محطة توليد\" OR \"عداد الكهرباء\" OR \"الطاقة المتجددة\" OR \"إنتاج النفط\" OR \"إنتاج الغاز\"";
const CONFLICT_EXCLUSIONS = "-war -warfare -missile -military -attack -airstrike -bombing -weapon -حرب -صاروخ -صواريخ -عسكري -هجوم -غارة -قصف";
const SITE_ENERGY_QUERY = "\"electricity\" OR \"power plant\" OR \"power grid\" OR \"renewable energy\" OR \"solar power\" OR \"wind power\" OR \"smart meter\" OR \"oil production\" OR \"gas production\" OR refinery OR pipeline OR LNG OR الكهرباء OR \"شبكة الكهرباء\" OR \"محطة توليد\" OR \"عداد الكهرباء\" OR \"الطاقة المتجددة\" OR \"إنتاج النفط\" OR \"إنتاج الغاز\"";

const PREFERRED_SITES = [
  ["almalnews.com", "ar"],
  ["attaqa.net", "ar"],
  ["argaam.com", "ar"],
  ["utilities-me.com", "en"],
  ["ognnews.com", "en"],
  ["mees.com", "en"],
  ["alborsaanews.com", "ar"],
  ["wam.ae", "ar"],
  ["amwalalghad.com", "en"],
  ["hespress.com", "ar"],
  ["shafaq.com", "ar"],
  ["maal.com", "ar"],
  ["albayan.ae", "ar"],
  ["emaratalyoum.com", "ar"],
  ["alanba.com.kw", "ar"],
  ["alwatan.com", "ar"],
  ["thepeninsulaqatar.com", "en"],
  ["egypttoday.com", "en"],
  ["gate.ahram.org.eg", "ar"],
  ["egelectricgate.com", "ar", "https://www.egelectricgate.com/?feed=rss2"],
  ["masrawy.com", "ar"],
  ["youm7.com", "ar"],
  ["zawya.com", "en"],
  ["almasryalyoum.com", "ar"],
  ["arabic.cnn.com", "ar"],
  ["alarabiya.net", "ar"],
  ["powernews.cc", "ar"],
  ["economyplusme.com", "ar"],
  ["taqanews.com", "ar"],
  ["asharqbusiness.com", "ar"],
  ["algerie-eco.com", "ar"],
  ["alghad.com", "ar"],
];

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
    query: `(${ENERGY_QUERY}) (MENA OR "Middle East" OR "North Africa" OR الخليج OR "الشرق الأوسط") ${CONFLICT_EXCLUSIONS}`,
    regions: [],
    locale: "en",
  },
  {
    query: `(الكهرباء OR "شبكة الكهرباء" OR "محطة توليد" OR "الطاقة المتجددة" OR "الطاقة الشمسية" OR "طاقة الرياح" OR "عداد الكهرباء" OR "إنتاج النفط" OR "إنتاج الغاز") (مصر OR الخليج OR الشرق الأوسط OR شمال أفريقيا) ${CONFLICT_EXCLUSIONS}`,
    regions: [],
    locale: "ar",
  },
  {
    query: `(smart meter OR prepaid meter OR AMI OR electricity meter OR عداد الكهرباء OR العدادات الذكية) (MENA OR Egypt OR Gulf OR مصر OR الخليج) ${CONFLICT_EXCLUSIONS}`,
    regions: [],
    locale: "en",
  },
  ...REGIONS.map(([key, english, arabic]) => ({
    query: `(${ENERGY_QUERY}) (${english} OR ${arabic}) ${CONFLICT_EXCLUSIONS}`,
    regions: [key],
    locale: /[\u0600-\u06ff]/.test(arabic) ? "ar" : "en",
  })),
  // Give every default listed website its own feed so coverage does not depend
  // on whether it appears in the broad regional Google News searches.
  ...PREFERRED_SITES.map(([site, locale, directUrl]) => ({
    query: `(${SITE_ENERGY_QUERY}) site:${site} ${CONFLICT_EXCLUSIONS}`,
    regions: [],
    locale,
    site,
    directUrl: directUrl || "",
    limit: 30,
  })),
];

function feedUrl(feed) {
  if (feed.directUrl) return feed.directUrl;

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

const POWER_INFRASTRUCTURE_KEYWORDS = [
  "electricity", "electric power", "power grid", "electricity grid", "electrical grid", "grid operator",
  "smart grid", "power plant", "power station", "power generation", "electricity generation",
  "generating capacity", "transmission grid", "transmission line", "substation", "transformer",
  "distribution network", "distribution company", "electric utility", "utility company",
  "electricity utility", "power utility", "electricity tariff", "electricity price", "electricity bill",
  "power outage", "blackout", "load shedding", "smart meter", "electricity meter", "prepaid meter",
  "renewable energy", "solar power", "solar farm", "photovoltaic", "wind power", "wind farm",
  "hydropower", "hydroelectric", "battery storage", "energy storage", "ev charging",
  "nuclear power plant", "nuclear reactor",
  "الكهرباء", "كهرباء", "شبكة الكهرباء", "شبكة نقل الكهرباء", "محطة كهرباء", "محطة توليد",
  "توليد الكهرباء", "قدرة توليد", "نقل الكهرباء", "توزيع الكهرباء", "شركة الكهرباء",
  "شركات الكهرباء", "مرفق الكهرباء", "تعريفة الكهرباء", "أسعار الكهرباء", "فاتورة الكهرباء",
  "انقطاع الكهرباء", "تخفيف الأحمال", "عداد الكهرباء", "عدادات الكهرباء", "عدادات ذكية",
  "الطاقة المتجددة", "الطاقة الشمسية", "محطة شمسية", "طاقة الرياح", "محطة رياح",
  "الطاقة الكهرومائية", "تخزين الطاقة", "بطاريات", "شحن السيارات الكهربائية",
  "محطة نووية", "مفاعل نووي"
];

const ENERGY_COMMODITY_KEYWORDS = [
  "oil", "crude", "petroleum", "natural gas", "lng", "gas", "energy",
  "الطاقة", "النفط", "البترول", "الغاز", "الخام"
];

const ENERGY_INDUSTRY_CONTEXT_KEYWORDS = [
  "production", "output", "export", "import", "refinery", "refining", "pipeline",
  "oilfield", "oil field", "gas field", "drilling", "exploration", "reserves", "capacity",
  "project", "investment", "contract", "company", "market", "prices", "supply", "demand",
  "ministry", "regulator", "megawatt", "gigawatt",
  "إنتاج", "استخراج", "تصدير", "استيراد", "مصفاة", "تكرير", "خط أنابيب", "حقل نفط",
  "حقل غاز", "حفر", "استكشاف", "احتياطيات", "قدرة", "مشروع", "استثمار", "عقد",
  "شركة", "سوق", "أسعار", "إمدادات", "طلب", "وزارة", "هيئة", "ميجاوات", "جيجاوات"
];

const CONFLICT_KEYWORDS = [
  "war", "warfare", "missile", "military", "attack", "airstrike", "air strike", "bomb",
  "bombing", "weapon", "troops", "army", "navy", "armed conflict", "fighting", "killed",
  "casualties", "ceasefire", "invasion",
  "حرب", "صاروخ", "صواريخ", "عسكري", "عسكرية", "هجوم", "غارة", "قصف", "سلاح",
  "أسلحة", "قوات", "جيش", "معارك", "قتلى", "ضحايا", "وقف إطلاق النار", "غزو"
];

function containsSearchTerm(text, term) {
  const cleanTerm = String(term || "").toLowerCase();
  if (!cleanTerm) return false;
  if (/^[a-z0-9 ]+$/.test(cleanTerm)) {
    return new RegExp(`(^|[^a-z0-9])${cleanTerm}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(cleanTerm);
}

function containsAnySearchTerm(text, terms) {
  return terms.some((term) => containsSearchTerm(text, term));
}

function isPowerSectorArticle(article) {
  // Publisher names can contain words such as "electricity"; only the
  // article's own title and description are allowed to establish relevance.
  const text = [
    article.title || "",
    article.description || "",
  ].join(" ").toLowerCase();

  const hasPowerInfrastructure = containsAnySearchTerm(text, POWER_INFRASTRUCTURE_KEYWORDS);
  const hasEnergyCommodity = containsAnySearchTerm(text, ENERGY_COMMODITY_KEYWORDS);
  const hasIndustryContext = containsAnySearchTerm(text, ENERGY_INDUSTRY_CONTEXT_KEYWORDS);
  const hasConflictContext = containsAnySearchTerm(text, CONFLICT_KEYWORDS);

  if (hasConflictContext && !hasPowerInfrastructure) return false;
  return hasPowerInfrastructure || (hasEnergyCommodity && hasIndustryContext);
}

function readSource(itemXml, feed) {
  if (feed.directUrl && feed.site) {
    return {
      name: "بوابة أخبار كهرباء مصر",
      url: "https://www.egelectricgate.com/",
    };
  }

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
      content: description,
      url: tagValue(itemXml, "link") || tagValue(itemXml, "guid"),
      image: "",
      publishedAt: Number.isNaN(published.getTime()) ? "" : published.toISOString(),
      source: readSource(itemXml, feed),
      provider: "Scheduled Google News index",
      regions: feed.regions,
      preferredSite: feed.site || "",
    };
  }).filter((article) =>
    article.title &&
    article.url &&
    article.publishedAt &&
    isPowerSectorArticle(article)
  );
}

function articleKey(article) {
  return `${article.title.toLowerCase()}|${article.source.name.toLowerCase()}`;
}

const collected = new Map();
let successfulFeeds = 0;

for (const feed of FEEDS) {
  try {
    const response = await fetch(feedUrl(feed), {
      headers: { "user-agent": "Power-News-Indexer/2.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Keep each geography represented instead of letting the broadest feeds
    // crowd smaller markets out of the final index.
    const articles = parseFeed(await response.text(), feed).slice(0, feed.limit || 60);
    for (const article of articles) {
      const key = articleKey(article);
      const existing = collected.get(key);
      if (existing) {
        existing.regions = [...new Set([...existing.regions, ...article.regions])];
        if (!existing.preferredSite && article.preferredSite) {
          existing.preferredSite = article.preferredSite;
        }
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
