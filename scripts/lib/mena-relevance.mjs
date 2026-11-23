// Shared relevance + geography rules for the MENA power news index.
// Used by scripts/build-news-index.mjs (and safe to import from tests).
//
// An article is kept only when BOTH are true:
//   1. it is about the power/energy sector (isPowerSectorArticle), and
//   2. it is about a MENA country or the region as a whole (detectRegions).
// Region tags are derived from the article text itself, never from which
// Google News feed happened to return it.

// ── Text normalisation ───────────────────────────────────────────────────────
export function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")          // Latin accents (é → e)
    .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[’'`]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

const AR = "\\u0600-\\u06FF";
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Arabic words take attached prefixes (و ب ل ف ك ال لل) and suffixes
// (ي ية يين يون ه ها). A plain substring test would match مصر inside مصرف
// (bank), so build a boundary-aware pattern instead.
function arabicPattern(term) {
  const t = normalizeText(term).trim();
  const body = escapeRegex(t);
  let prefix = "(?:[وفبكل]?(?:ال)?)";
  if (t.startsWith("ال")) {
    const rest = escapeRegex(t.slice(2));
    return `(?:^|[^${AR}])(?:[وفبك]?${body}|لل${rest})(?:ي|يه|ية|يين|يون|يتان|يان|ه|ها|ان|تان|ين|ات)?(?=$|[^${AR}])`;
  }
  return `(?:^|[^${AR}])${prefix}${body}(?:ي|يه|ية|يين|يون|يتان|يان|ه|ها|ان|تان|ين|ات)?(?=$|[^${AR}])`;
}

function latinPattern(term) {
  const t = escapeRegex(normalizeText(term).trim());
  return `(?:^|[^a-z0-9])${t}(?=$|[^a-z0-9])`;
}

export function compileTerms(terms) {
  const parts = terms.map((term) =>
    /[؀-ۿ]/.test(term) ? arabicPattern(term) : latinPattern(term)
  );
  return parts.length ? new RegExp(parts.join("|"), "i") : /$^/;
}

// ── MENA geography ───────────────────────────────────────────────────────────
// Keys match the <select id="regionFilter"> values in index.html.
export const COUNTRIES = {
  "egypt": { label: "Egypt", ar: "مصر", terms: [
    "egypt", "egyptian", "cairo", "alexandria", "giza", "sinai", "suez", "aswan", "benban",
    "el dabaa", "dabaa", "eehc", "egyptera", "egas", "egpc", "new administrative capital", "egypte",
    "مصر", "القاهرة", "الجيزة", "الاسكندرية", "سيناء", "السويس", "اسوان", "بنبان", "الضبعة",
    "القابضة لكهرباء مصر", "الشبكة القومية للكهرباء", "جهاز تنظيم مرفق الكهرباء",
    "الكهرباء والطاقة المتجددة", "العاصمة الادارية", "المصرية لنقل الكهرباء", "الصعيد", "الدلتا"] },
  "saudi arabia": { label: "Saudi Arabia", ar: "السعودية", terms: [
    "saudi", "saudi arabia", "riyadh", "jeddah", "dammam", "neom", "aramco", "acwa power",
    "saudi electricity", "saudi power procurement", "red sea global", "arabie saoudite",
    "السعودية", "سعودي", "الرياض", "جدة", "الدمام", "نيوم", "ارامكو", "اكوا باور",
    "السعودية للكهرباء", "الشركة السعودية لشراء الطاقة", "رؤية 2030"] },
  "UAE": { label: "UAE", ar: "الإمارات", terms: [
    "uae", "emirati", "united arab emirates", "abu dhabi", "dubai", "sharjah", "ajman",
    "ras al khaimah", "fujairah", "dewa", "adnoc", "masdar", "ewec", "enec", "barakah",
    "emirates water and electricity", "etihad water and electricity", "emirats arabes unis",
    "الامارات", "اماراتي", "ابوظبي", "ابو ظبي", "دبي", "الشارقة", "عجمان", "راس الخيمة",
    "الفجيرة", "هيئة كهرباء ومياه دبي", "ديوا", "ادنوك", "براكة", "الاتحاد للماء والكهرباء"] },
  "iraq": { label: "Iraq", ar: "العراق", terms: [
    "iraq", "iraqi", "baghdad", "basra", "erbil", "kurdistan", "mosul", "kirkuk", "irak",
    "العراق", "عراقي", "بغداد", "البصرة", "اربيل", "كردستان", "الموصل", "كركوك"] },
  "iran": { label: "Iran", ar: "إيران", terms: [
    "iran", "iranian", "tehran", "ايران", "ايراني", "طهران"] },
  "libya": { label: "Libya", ar: "ليبيا", terms: [
    "libya", "libyan", "tripoli", "benghazi", "gecol", "libye",
    "ليبيا", "ليبي", "طرابلس", "بنغازي", "الشركة العامة للكهرباء"] },
  "algeria": { label: "Algeria", ar: "الجزائر", terms: [
    "algeria", "algerian", "algiers", "sonelgaz", "sonatrach", "algerie", "algerien", "alger",
    "الجزائر", "جزائري", "سونلغاز", "سوناطراك"] },
  "morocco": { label: "Morocco", ar: "المغرب", terms: [
    "morocco", "moroccan", "rabat", "casablanca", "marrakech", "tangier", "ouarzazate",
    "onee", "masen", "maroc", "marocain", "marocaine",
    "المغرب", "مغربي", "الرباط", "الدار البيضاء", "مراكش", "طنجة", "ورزازات",
    "المكتب الوطني للكهرباء", "الوكالة المغربية للطاقة المستدامة"] },
  "tunisia": { label: "Tunisia", ar: "تونس", terms: [
    "tunisia", "tunisian", "tunis", "steg", "tunisie", "tunisien",
    "تونس", "تونسي", "الستاغ", "الشركة التونسية للكهرباء والغاز"] },
  "jordan": { label: "Jordan", ar: "الأردن", terms: [
    "jordan", "jordanian", "amman", "aqaba", "nepco", "jordanie",
    "الاردن", "اردني", "العقبة", "شركة الكهرباء الوطنية"] },
  "kuwait": { label: "Kuwait", ar: "الكويت", terms: [
    "kuwait", "kuwaiti", "koweit", "الكويت", "كويتي"] },
  "qatar": { label: "Qatar", ar: "قطر", terms: [
    "qatar", "qatari", "doha", "kahramaa", "qatarenergy", "nebras power",
    "قطر", "قطري", "الدوحة", "كهرماء", "قطر للطاقة"] },
  "oman": { label: "Oman", ar: "عُمان", terms: [
    "oman", "omani", "muscat", "nama group", "oman lng",
    "سلطنة عمان", "عماني", "العماني", "مسقط"] },
  "bahrain": { label: "Bahrain", ar: "البحرين", terms: [
    "bahrain", "bahraini", "manama", "bapco", "bahrein",
    "البحرين", "بحريني", "المنامة", "هيئة الكهرباء والماء"] },
  "lebanon": { label: "Lebanon", ar: "لبنان", terms: [
    "lebanon", "lebanese", "beirut", "electricite du liban", "liban",
    "لبنان", "لبناني", "بيروت", "كهرباء لبنان"] },
  "syria": { label: "Syria", ar: "سوريا", terms: [
    "syria", "syrian", "damascus", "aleppo", "syrie",
    "سوريا", "سورية", "سوري", "دمشق", "حلب"] },
  "palestine": { label: "Palestine", ar: "فلسطين", terms: [
    "palestine", "palestinian", "gaza", "west bank", "ramallah",
    "فلسطين", "فلسطيني", "غزة", "الضفة الغربية", "رام الله"] },
  "israel": { label: "Israel", ar: "إسرائيل", terms: [
    "israel", "israeli", "leviathan", "اسرائيل", "اسرائيلي", "ليفياثان"] },
  "yemen": { label: "Yemen", ar: "اليمن", terms: [
    "yemen", "yemeni", "sanaa", "aden", "اليمن", "يمني", "صنعاء", "عدن"] },
  "sudan": { label: "Sudan", ar: "السودان", terms: [
    "sudan", "sudanese", "khartoum", "soudan", "السودان", "سوداني", "الخرطوم"] },
  "mauritania": { label: "Mauritania", ar: "موريتانيا", terms: [
    "mauritania", "mauritanian", "nouakchott", "mauritanie", "موريتانيا", "موريتاني", "نواكشوط"] },
  "turkey": { label: "Turkey", ar: "تركيا", terms: [
    "turkey", "turkish", "turkiye", "ankara", "istanbul", "botas", "turquie",
    "تركيا", "تركي", "انقرة", "اسطنبول"] },
};

// Region-wide signals (no single country). "gulf" alone is deliberately
// excluded because of "Gulf of Mexico"; only Arabian/Persian Gulf forms count.
const REGIONAL_TERMS = [
  "mena", "middle east", "north africa", "arabian gulf", "persian gulf", "gulf states",
  "gulf countries", "gulf region", "gulf cooperation council", "gcc", "levant", "maghreb",
  "red sea", "arab world", "arab countries", "arab region", "eastern mediterranean",
  "moyen orient", "afrique du nord",
  "الشرق الاوسط", "شمال افريقيا", "الخليج", "الخليجي", "دول الخليج", "مجلس التعاون",
  "المغرب العربي", "الشام", "الدول العربية", "العالم العربي", "البحر الاحمر", "عمان",
  "الربط الكهربائي العربي", "شرق المتوسط"
];

// Strong non-MENA signals. Used only to stop "implicit" home-country tagging
// of a local website's article about, say, US or Chinese power plants.
const FOREIGN_TERMS = [
  "united states", "u.s.", "us", "eu", "european union", "america", "american", "china", "chinese", "europe", "european",
  "germany", "german", "britain", "british", "uk", "india", "indian", "japan", "japanese",
  "russia", "russian", "france", "french", "vietnam", "australia", "canada", "brazil",
  "nigeria", "south africa", "kenya", "ireland", "texas", "california", "korea", "korean",
  "امريكا", "امريكي", "الولايات المتحدة", "الصين", "صيني", "اوروبا", "اوروبي", "المانيا",
  "الماني", "بريطانيا", "بريطاني", "الهند", "هندي", "اليابان", "ياباني", "روسيا", "روسي",
  "فرنسا", "فرنسي", "فيتنام", "استراليا", "كندا", "البرازيل", "نيجيريا", "جنوب افريقيا",
  "كوريا", "كوري", "الاتحاد الاوروبي"
];

const COUNTRY_MATCHERS = Object.entries(COUNTRIES).map(([key, c]) => [key, compileTerms(c.terms)]);
const REGIONAL_MATCHER = compileTerms(REGIONAL_TERMS);
const FOREIGN_MATCHER = compileTerms(FOREIGN_TERMS);

export function articleText(article) {
  // Publisher names can contain country words ("Egypt Oil & Gas"); only the
  // article's own title and description count.
  // Google News descriptions are "<title> <publisher>", so drop the publisher.
  const name = (article.source && article.source.name) || "";
  let description = String(article.description || "").replace(/&nbsp;/g, " ");
  if (name) description = description.split(name).join(" ");
  return normalizeText(`${stripSourceSuffix(article)} ${description}`);
}

/**
 * Returns { countries: [...keys], regional: bool, foreign: bool }.
 */
export function detectGeography(article) {
  const text = ` ${articleText(article)} `;
  const countries = COUNTRY_MATCHERS.filter(([, re]) => re.test(text)).map(([key]) => key);
  return {
    countries,
    regional: REGIONAL_MATCHER.test(text),
    foreign: FOREIGN_MATCHER.test(text),
  };
}

// ── Sector relevance ─────────────────────────────────────────────────────────
const POWER_INFRASTRUCTURE_KEYWORDS = [
  "electricity", "electric power", "power grid", "electricity grid", "electrical grid", "grid operator",
  "smart grid", "power plant", "power station", "power generation", "electricity generation",
  "generating capacity", "transmission grid", "transmission line", "substation", "transformer",
  "distribution network", "distribution company", "electric utility", "utility company",
  "electricity utility", "power utility", "electricity tariff", "electricity price", "electricity bill",
  "power outage", "power cuts", "blackout", "load shedding", "smart meter", "smart meters",
  "electricity meter", "prepaid meter", "prepaid meters", "metering",
  "renewable energy", "renewables", "solar power", "solar plant", "solar farm", "solar park",
  "solar project", "photovoltaic", "wind power", "wind farm", "wind project", "hydropower",
  "hydroelectric", "battery storage", "energy storage", "bess", "ev charging", "green hydrogen",
  "interconnection", "interconnector", "power purchase agreement", "ppa", "independent power producer",
  "nuclear power plant", "nuclear reactor", "megawatt", "gigawatt", "mw", "gw",
  // French (Maghreb press)
  "electricite", "reseau electrique", "centrale electrique", "centrale solaire", "parc eolien",
  "energie renouvelable", "energies renouvelables", "energie solaire", "eolien", "eolienne",
  "photovoltaique", "compteur", "compteurs intelligents", "coupure d electricite",
  "production d electricite", "hydrogene vert", "stockage d energie",
  // Arabic
  "الكهرباء", "كهرباء", "كهربائي", "كهربائية", "شبكة الكهرباء", "شبكة نقل الكهرباء", "محطة كهرباء",
  "محطة توليد", "محطات توليد", "توليد الكهرباء", "قدرة توليد", "نقل الكهرباء", "توزيع الكهرباء",
  "شركة الكهرباء", "شركات الكهرباء", "مرفق الكهرباء", "تعريفة الكهرباء", "اسعار الكهرباء",
  "فاتورة الكهرباء", "انقطاع الكهرباء", "تخفيف الاحمال", "عداد الكهرباء", "عدادات الكهرباء",
  "عدادات ذكية", "العدادات الذكية", "عدادات مسبقة الدفع", "العداد الكودي", "العدادات الكودية",
  "الطاقة المتجددة", "الطاقات المتجددة", "الطاقة النظيفة", "الطاقة الشمسية", "محطة شمسية",
  "طاقة الرياح", "محطة رياح", "مزرعة رياح", "الطاقة الكهرومائية", "تخزين الطاقة", "تخزين البطاريات",
  "شحن السيارات الكهربائية", "بطاريات", "الهيدروجين الاخضر", "الربط الكهربائي", "ميجاوات", "جيجاوات",
  "محطة نووية", "مفاعل نووي", "محطة الضبعة"
];

const ENERGY_COMMODITY_KEYWORDS = [
  "oil", "crude", "petroleum", "natural gas", "lng", "gas", "energy", "refinery", "fuel",
  "petrole", "gaz", "gaz naturel", "gnl", "energie",
  "الطاقة", "النفط", "البترول", "الغاز", "الخام", "الغاز الطبيعي", "الغاز المسال", "مصفاة", "مصافي", "الوقود"
];

const ENERGY_INDUSTRY_CONTEXT_KEYWORDS = [
  "production", "output", "export", "exports", "import", "imports", "refinery", "refining", "pipeline",
  "oilfield", "oil field", "gas field", "drilling", "exploration", "reserves", "capacity",
  "project", "investment", "contract", "company", "market", "prices", "supply", "demand",
  "ministry", "minister", "regulator", "discovery", "bpd", "barrels",
  "raffinerie", "gazoduc", "oleoduc", "gisement", "contrat", "investissement", "prix", "exportation",
  "انتاج", "استخراج", "تصدير", "صادرات", "استيراد", "واردات", "مصفاة", "تكرير", "خط انابيب",
  "حقل", "حقول", "حفر", "استكشاف", "اكتشاف", "احتياطيات", "قدرة", "مشروع", "استثمار", "عقد",
  "شركة", "سوق", "اسعار", "امدادات", "طلب", "وزارة", "وزير", "هيئة", "برميل"
];

const CONFLICT_KEYWORDS = [
  "war", "warfare", "missile", "military", "attack", "airstrike", "air strike", "bomb",
  "bombing", "weapon", "troops", "army", "navy", "armed conflict", "fighting", "killed",
  "casualties", "ceasefire", "invasion",
  "حرب", "صاروخ", "صواريخ", "عسكري", "عسكرية", "هجوم", "غارة", "قصف", "سلاح",
  "اسلحة", "قوات", "جيش", "معارك", "قتلي", "ضحايا", "وقف اطلاق النار", "غزو"
];

// Arabic sector words are matched as substrings (كهرباء inside الكهربائية is
// fine); Latin ones need word boundaries.
function compileSectorTerms(terms) {
  const latin = terms.filter((t) => !/[؀-ۿ]/.test(t));
  const arabic = terms.filter((t) => /[؀-ۿ]/.test(t)).map((t) => escapeRegex(normalizeText(t)));
  const parts = latin.map(latinPattern);
  if (arabic.length) parts.push(`(?:${arabic.join("|")})`);
  return new RegExp(parts.join("|"), "i");
}

const POWER_RE = compileSectorTerms(POWER_INFRASTRUCTURE_KEYWORDS);
const COMMODITY_RE = compileSectorTerms(ENERGY_COMMODITY_KEYWORDS);
const CONTEXT_RE = compileSectorTerms(ENERGY_INDUSTRY_CONTEXT_KEYWORDS);
const CONFLICT_RE = compileSectorTerms(CONFLICT_KEYWORDS);

/** Returns "power", "oil-gas" or "" (not relevant). */
export function classifySector(article) {
  const text = ` ${articleText(article)} `;
  const power = POWER_RE.test(text);
  const commodity = COMMODITY_RE.test(text) && CONTEXT_RE.test(text);
  if (CONFLICT_RE.test(text) && !power) return "";
  if (power) return "power";
  if (commodity) return "oil-gas";
  return "";
}

export function isPowerSectorArticle(article) {
  return classifySector(article) !== "";
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Google News titles end with " - Publisher". Strip it for matching/dedupe.
export function stripSourceSuffix(article) {
  const title = article.title || "";
  const name = article.source && article.source.name;
  if (name && title.endsWith(` - ${name}`)) return title.slice(0, -(name.length + 3)).trim();
  return title.replace(/\s+[-–|]\s+[^-–|]{2,60}$/, "").trim();
}

export function dedupeKey(article) {
  return normalizeText(stripSourceSuffix(article))
    .replace(/[^a-z0-9؀-ۿ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Final decision for one article. `siteCountry` is the home country of the
 * preferred website the article came from ("" for pan-regional/unknown).
 * Returns { keep, regions, topic }.
 */
export function evaluateArticle(article, siteCountry = "") {
  const topic = classifySector(article);
  if (!topic) return { keep: false, regions: [], topic };

  const geo = detectGeography(article);
  let regions = geo.countries;
  if (!regions.length && geo.regional) regions = ["mena"];
  // A local outlet's domestic story often omits the country name
  // ("وزير الكهرباء يتفقد محطة..."). Trust the outlet's home country unless
  // the text clearly points somewhere outside MENA.
  if (!regions.length && siteCountry && !geo.foreign) regions = [siteCountry];

  return { keep: regions.length > 0, regions, topic };
}
