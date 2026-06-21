// MENA Power & Energy News -- App Logic
// GNews.io free API + CORS proxy chain
// Search is locked to MENA + related energy/power keywords, with optional user keywords and preferred source domains.

var GNEWS_BASE = "https://gnews.io/api/v4/search";

// Keep API usage controlled for the GNews free quota.
// Wider date ranges are split into a small number of non-overlapping date windows
// so the app does not keep returning only the latest first page.
// No browser cache is used; every search fetches fresh results from GNews.
var REQUEST_COUNT_PREFIX = "gnews-request-count:";
var GNEWS_FREE_RATE_DELAY_MS = 1100;
var PAGE_REFRESH_INTERVAL_MS = 10 * 60 * 60 * 1000;
var lastSearchRequestInfo = { apiCalls: 0, dateWindows: 0, plannedCalls: 0 };

// ── MENA geography ────────────────────────────────────────────────────────────
// English + Arabic signals used for client-side regional filtering.
var MENA_COUNTRIES = [
  "egypt", "saudi arabia", "saudi", "uae", "united arab emirates", "iraq", "iran",
  "libya", "algeria", "morocco", "jordan", "kuwait", "qatar", "turkey", "oman", "bahrain",
  "yemen", "tunisia", "sudan", "syria", "lebanon", "palestine", "israel", "gaza",
  "west bank", "sinai", "persian gulf", "arabian gulf", "red sea", "nile",
  "middle east", "north africa", "mena", "gulf", "levant", "maghreb",
  "مصر", "القاهرة", "الجيزة", "القاهرة الكبرى", "جنوب القاهرة", "الإسكندرية", "سيناء",
  "السعودية", "المملكة العربية السعودية", "الإمارات", "الامارات", "أبوظبي", "ابوظبي", "دبي",
  "العراق", "بغداد", "إيران", "ايران", "ليبيا", "الجزائر", "المغرب", "الأردن", "الاردن",
  "الكويت", "قطر", "تركيا", "عمان", "البحرين", "اليمن", "تونس", "السودان", "سوريا",
  "لبنان", "فلسطين", "غزة", "الضفة الغربية", "الشرق الأوسط", "الشرق الاوسط", "شمال أفريقيا",
  "شمال افريقيا", "الخليج", "المغرب العربي", "الشام"
];

// Country filter dropdown -> GNews country code.
var COUNTRY_CODES = {
  "egypt": "eg", "saudi arabia": "sa", "UAE": "ae", "iraq": "iq", "iran": "ir",
  "libya": "ly", "algeria": "dz", "morocco": "ma", "jordan": "jo",
  "kuwait": "kw", "qatar": "qa", "turkey": "tr"
};

var REGION_ARABIC_TERMS = {
  "egypt": "مصر القاهرة",
  "saudi arabia": "السعودية",
  "UAE": "الإمارات",
  "iraq": "العراق بغداد",
  "iran": "إيران",
  "libya": "ليبيا",
  "algeria": "الجزائر",
  "morocco": "المغرب",
  "jordan": "الأردن",
  "kuwait": "الكويت",
  "qatar": "قطر",
  "turkey": "تركيا"
};

var SECTOR_ARABIC_TERMS = {
  "electricity grid": "الكهرباء عداد الكهرباء شبكة الكهرباء العدادات الذكية",
  "oil petroleum": "البترول النفط",
  "natural gas": "الغاز الطبيعي",
  "solar renewable energy": "الطاقة الشمسية الطاقة المتجددة",
  "nuclear power": "الطاقة النووية",
  "energy policy": "الطاقة الكهرباء التعريفة"
};

// Fixed relevance list used to reject unrelated general news.
// Keep terms lowercase where applicable because matching is case-insensitive.
var RELATED_ENERGY_KEYWORDS = [
  "electricity", "electric", "power", "energy", "grid", "smart grid",
  "smart meter", "electricity meter", "electric meter", "prepaid meter", "metering",
  "ami", "advanced metering", "dlms", "utility", "utilities",
  "distribution company", "distribution network", "transmission", "transmission line",
  "transformer", "substation", "switchgear", "cable", "outage", "blackout",
  "power cut", "load shedding", "tariff", "energy policy", "electricity tariff",
  "power plant", "generation", "renewable energy", "renewables", "solar", "solar farm",
  "pv", "photovoltaic", "wind power", "wind farm", "hydropower", "battery",
  "energy storage", "battery storage", "ev charging", "electric vehicle charging",
  "nuclear power", "nuclear energy", "natural gas", "gas field", "lng", "oil",
  "petroleum", "refinery", "pipeline", "hydrogen", "green hydrogen",
  "كهرباء", "الكهرباء", "الطاقة", "الطاقة المتجددة", "الطاقة الشمسية", "الشبكة", "الشبكة القومية",
  "شبكة الكهرباء", "تغذية كهربائية", "التغذية الكهربائية", "شركة توزيع الكهرباء", "شركات توزيع الكهرباء",
  "وزارة الكهرباء", "الكهرباء والطاقة", "عداد كهرباء", "عداد الكهرباء", "عدادات كهرباء", "عدادات الكهرباء",
  "عدادات كهربائية", "عدادات كهبرائية", "عدادات مسبقة الدفع", "عداد مسبق الدفع", "مسبق الدفع",
  "عدادات ذكية", "عداد ذكي", "العداد الذكي", "العدادات الذكية", "عداد كودي", "عداد الكهرباء الكودي",
  "العداد الكودي", "عدادات كودية", "العدادات الكودية", "تحويل العداد", "تحويل العدادات",
  "المنصة الموحدة لخدمات الكهرباء", "استهلاك كهربائي", "الاستهلاك الكهربائي", "محاضر سرقة التيار",
  "سرقة التيار", "التيار الكهربائي", "تعريفة الكهرباء", "أسعار الكهرباء", "اسعار الكهرباء"
];

// Default preferred websites. These are now preferred sources, not strict blockers unless the checkbox is enabled.
var DEFAULT_SOURCE_WEBSITES = [
  "almalnews.com",
  "attaqa.net",
  "argaam.com",
  "utilities-me.com",
  "ognnews.com",
  "mees.com",
  "alborsaanews.com",
  "wam.ae",
  "amwalalghad.com",
  "hespress.com",
  "shafaq.com",
  "maal.com",
  "albayan.ae",
  "emaratalyoum.com",
  "alanba.com.kw",
  "alwatan.com",
  "thepeninsulaqatar.com",
  "egypttoday.com",
  "gate.ahram.org.eg",
  "masrawy.com",
  "youm7.com",
  "powernews.cc",
  "economyplusme.com",
  "taqanews.com",
  "asharqbusiness.com",
  "algerie-eco.com",
  "alghad.com"
];

// ── CORS proxy chain ──────────────────────────────────────────────────────────
var CORS_PROXIES = [
  function(url){ return "https://corsproxy.io/?url=" + encodeURIComponent(url); },
  function(url){ return "https://api.allorigins.win/raw?url=" + encodeURIComponent(url); },
  function(url){ return "https://corsmirror.onrender.com/v1/cors?url=" + encodeURIComponent(url); }
];

async function fetchWithProxy(rawUrl) {
  var lastError = null;
  for (var i = 0; i < CORS_PROXIES.length; i++) {
    try {
      var res = await fetch(CORS_PROXIES[i](rawUrl));
      if (res.status !== 0) return res;
    } catch (err) {
      lastError = err;
      console.warn("Proxy " + (i + 1) + " failed:", err.message);
    }
  }
  throw new Error(lastError ? "All proxies failed (" + lastError.message + ")." : "All proxies failed.");
}

// ── Keyword and source website state ─────────────────────────────────────────
var keywords = [];
var sourceWebsites = DEFAULT_SOURCE_WEBSITES.slice();
var filtersPanelVisible = false;

function addKeyword() {
  var input = document.getElementById("kwInput");
  var val = input.value.trim().toLowerCase();
  if (!val || keywords.indexOf(val) !== -1) { input.value = ""; return; }
  keywords.push(val);
  renderTags();
  renderFiltersPanel();
  input.value = "";
  input.focus();
}

function removeKeyword(kw) {
  var idx = keywords.indexOf(kw);
  if (idx > -1) keywords.splice(idx, 1);
  renderTags();
  renderFiltersPanel();
}

function renderTags() {
  var c = document.getElementById("tagContainer");
  c.innerHTML = keywords.map(function(k) {
    return '<span class="tag">' + escHtml(k) +
      '<button class="tag-remove" data-keyword="' + escAttr(k) + '" aria-label="Remove keyword ' + escAttr(k) + '">x</button></span>';
  }).join("");
}

function normalizeDomain(value) {
  if (!value) return "";
  var domain = String(value).trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.split("/")[0];
  domain = domain.split("?")[0];
  domain = domain.split("#")[0];
  domain = domain.replace(/:\d+$/, "");
  domain = domain.replace(/\.$/, "");
  return domain;
}

function addSourceWebsite() {
  var input = document.getElementById("sourceInput");
  var domain = normalizeDomain(input.value);
  if (!domain || sourceWebsites.indexOf(domain) !== -1) { input.value = ""; return; }
  sourceWebsites.push(domain);
  renderSourceTags();
  renderFiltersPanel();
  input.value = "";
  input.focus();
}

function removeSourceWebsite(domain) {
  var idx = sourceWebsites.indexOf(domain);
  if (idx > -1) sourceWebsites.splice(idx, 1);
  renderSourceTags();
  renderFiltersPanel();
}

function renderSourceTags() {
  var c = document.getElementById("sourceContainer");
  c.innerHTML = sourceWebsites.map(function(domain) {
    return '<span class="tag source-tag">' + escHtml(domain) +
      '<button class="source-remove" data-domain="' + escAttr(domain) + '" aria-label="Remove source website ' + escAttr(domain) + '">x</button></span>';
  }).join("");
}

function isStrictSourceMode() {
  var strictToggle = document.getElementById("strictSourceToggle");
  return !!(strictToggle && strictToggle.checked);
}

function isDeepSearchMode() {
  var deepToggle = document.getElementById("deepSearchToggle");
  return !!(deepToggle && deepToggle.checked);
}

function toggleFiltersPanel() {
  filtersPanelVisible = !filtersPanelVisible;
  renderFiltersPanel();
}

function renderFiltersPanel() {
  var panel = document.getElementById("filtersPanel");
  if (!panel) return;

  if (!filtersPanelVisible) {
    panel.classList.add("hidden");
    return;
  }

  var keywordText = keywords.length ? keywords.map(escHtml).join(", ") : "No keywords added";
  var sourceText = sourceWebsites.length ? sourceWebsites.map(escHtml).join(", ") : "No source websites added";
  var sourceMode = isStrictSourceMode()
    ? "Strict — only articles from listed websites are shown"
    : "Preferred — listed websites are prioritized but other relevant articles are allowed";
  var requestMode = isDeepSearchMode()
    ? "Deep recall — date-window coverage plus alternate Arabic/English queries, capped at 6 calls"
    : "Quota saver — 1 to 4 date-window calls depending on the selected range";
  var todayRequests = getTodayRequestCount();
  var defaultKwHtml = RELATED_ENERGY_KEYWORDS.map(function(k) {
    return '<span class="filter-chip">' + escHtml(k) + '</span>';
  }).join("");

  panel.innerHTML =
    '<div class="filters-panel-head">' +
      '<strong>Active search filters</strong>' +
      '<button class="panel-close" id="closeFiltersBtn" aria-label="Close filters panel">x</button>' +
    '</div>' +
    '<div class="filters-row"><span>Keywords:</span><p>' + keywordText + '</p></div>' +
    '<div class="filters-row"><span>Source websites:</span><p>' + sourceText + '</p></div>' +
    '<div class="filters-row"><span>Source mode:</span><p>' + escHtml(sourceMode) + '</p></div>' +
    '<div class="filters-row"><span>Request mode:</span><p>' + escHtml(requestMode) + '</p></div>' +
    '<div class="filters-row"><span>Today API calls:</span><p>' + escHtml(String(todayRequests)) + ' tracked in this browser</p></div>' +
    '<div class="filters-row filters-default"><span>Default related keywords:</span><div class="filter-chip-list">' + defaultKwHtml + '</div></div>';

  panel.classList.remove("hidden");

  var closeBtn = document.getElementById("closeFiltersBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", function() {
      filtersPanelVisible = false;
      renderFiltersPanel();
    });
  }
}


// ── API quota helpers ────────────────────────────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayRequestCount() {
  var key = REQUEST_COUNT_PREFIX + getTodayKey();
  return parseInt(localStorage.getItem(key) || "0", 10) || 0;
}

function recordApiRequest() {
  var key = REQUEST_COUNT_PREFIX + getTodayKey();
  var count = getTodayRequestCount() + 1;
  localStorage.setItem(key, String(count));
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISODate(d) {
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function setDefaultDates() {
  var now = new Date();
  var oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  document.getElementById("dateTo").value = toISODate(now);
  document.getElementById("dateFrom").value = toISODate(oneWeekAgo);
}

function schedulePageRefresh() {
  window.setTimeout(function() {
    window.location.reload();
  }, PAGE_REFRESH_INTERVAL_MS);
}

function toRFC3339(dateStr, endOfDay) {
  return dateStr + (endOfDay ? "T23:59:59Z" : "T00:00:00Z");
}

function parseDateInputUTC(dateStr) {
  var parts = String(dateStr || "").split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function formatUTCDate(d) {
  return d.toISOString().slice(0, 10);
}

function addUTCDays(d, days) {
  var copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function inclusiveDayCount(dateFrom, dateTo) {
  var start = parseDateInputUTC(dateFrom);
  var end = parseDateInputUTC(dateTo);
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function getDateWindowCount(dateFrom, dateTo) {
  var days = inclusiveDayCount(dateFrom, dateTo);
  if (days <= 7) return 1;
  if (days <= 30) return 2;
  if (days <= 90) return 3;
  return 4;
}

function buildDateWindows(dateFrom, dateTo) {
  var start = parseDateInputUTC(dateFrom);
  var end = parseDateInputUTC(dateTo);
  var totalDays = inclusiveDayCount(dateFrom, dateTo);
  var requestedWindows = getDateWindowCount(dateFrom, dateTo);
  var count = Math.max(1, Math.min(requestedWindows, totalDays));
  var baseSize = Math.floor(totalDays / count);
  var remainder = totalDays % count;
  var windows = [];
  var cursor = start;

  for (var i = 0; i < count; i++) {
    var size = baseSize + (i < remainder ? 1 : 0);
    var windowEnd = addUTCDays(cursor, size - 1);
    windows.push({ from: formatUTCDate(cursor), to: formatUTCDate(windowEnd) });
    cursor = addUTCDays(windowEnd, 1);
  }

  // Search the newest window first, but still sample the full selected range.
  return windows.reverse();
}

function getSearchCallBudget(dateWindows, deepRecall) {
  if (!deepRecall) return dateWindows.length;
  return Math.min(6, Math.max(dateWindows.length, dateWindows.length + 2));
}

function buildSearchTasks(queries, dateWindows, deepRecall) {
  var budget = getSearchCallBudget(dateWindows, deepRecall);
  var tasks = [];
  var q;
  var w;

  // First priority: one primary query for every date window.
  for (w = 0; w < dateWindows.length && tasks.length < budget; w++) {
    tasks.push({ query: queries[0], from: dateWindows[w].from, to: dateWindows[w].to, page: 1 });
  }

  // Deep recall: spend remaining calls on alternate English/Arabic queries, newest windows first.
  for (q = 1; q < queries.length && tasks.length < budget; q++) {
    for (w = 0; w < dateWindows.length && tasks.length < budget; w++) {
      tasks.push({ query: queries[q], from: dateWindows[w].from, to: dateWindows[w].to, page: 1 });
    }
  }

  return tasks;
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ── Query builder ─────────────────────────────────────────────────────────────
function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ""));
}

function uniquePush(list, value) {
  var clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean && list.indexOf(clean) === -1) list.push(clean);
}

function limitQuery(q) {
  return String(q || "").replace(/\s+/g, " ").trim().slice(0, 190);
}

function buildEnglishQuery(region, userKeywords) {
  var parts = [];

  if (userKeywords.length > 0) {
    parts.push(userKeywords[0]);
    if (userKeywords.length > 1 && userKeywords[1].length < 30) parts.push(userKeywords[1]);
    if (!hasArabic(userKeywords.join(" "))) parts.push("energy electricity");
  } else {
    parts.push("energy electricity power");
  }

  if (region) {
    parts.push(region);
  } else {
    parts.push("Middle East OR MENA");
  }

  return limitQuery(parts.join(" "));
}

function buildArabicQuery(region, userKeywords) {
  var parts = [];
  var userText = userKeywords.join(" ").trim();

  if (userText && hasArabic(userText)) {
    parts.push(userText);
  } else {
    parts.push("الكهرباء عداد الكهرباء الطاقة");
  }

  if (region && REGION_ARABIC_TERMS[region]) {
    parts.push(REGION_ARABIC_TERMS[region]);
  } else {
    parts.push("الشرق الأوسط الخليج شمال أفريقيا");
  }

  return limitQuery(parts.join(" "));
}

function buildSingleQuery(region, userKeywords) {
  var userText = userKeywords.join(" ").trim();
  var regionText = "";
  var sectorText = "";

  if (region) {
    regionText = region;
    if (REGION_ARABIC_TERMS[region]) regionText += " OR " + REGION_ARABIC_TERMS[region];
  } else {
    regionText = "MENA OR Egypt OR Gulf OR مصر OR الخليج";
  }

  if (userText) {
    sectorText = userText;
    if (!hasArabic(userText)) sectorText += " OR electricity OR energy";
  } else {
    sectorText = "electricity OR energy OR power OR grid OR solar OR كهرباء OR الطاقة OR عداد الكهرباء";
  }

  return limitQuery("(" + sectorText + ") AND (" + regionText + ")");
}

function buildQueries(region, userKeywords, deepRecall) {
  var queries = [];
  var userText = userKeywords.join(" ");

  // Quota-saver default: one combined Arabic + English query only.
  uniquePush(queries, buildSingleQuery(region, userKeywords));

  // Optional deep recall mode. Use only when the user accepts extra API usage.
  if (deepRecall) {
    uniquePush(queries, buildEnglishQuery(region, userKeywords));
    uniquePush(queries, buildArabicQuery(region, userKeywords));

    if (!userKeywords.length || hasArabic(userText)) {
      uniquePush(queries, limitQuery("عداد الكهرباء العدادات الذكية عدادات مسبقة الدفع " + (REGION_ARABIC_TERMS[region] || "مصر الشرق الأوسط")));
    }
  }

  return queries.slice(0, deepRecall ? 3 : 1);
}

function buildApiUrl(query, dateFrom, dateTo, region, sortBy, page) {
  var apiUrl = GNEWS_BASE +
    "?q=" + encodeURIComponent(query) +
    "&max=10" +
    "&page=" + encodeURIComponent(page || 1) +
    "&sortby=" + encodeURIComponent(sortBy) +
    "&in=" + encodeURIComponent("title,description,content") +
    "&nullable=" + encodeURIComponent("description,content,image") +
    "&from=" + encodeURIComponent(toRFC3339(dateFrom, false)) +
    "&to=" + encodeURIComponent(toRFC3339(dateTo, true)) +
    "&apikey=" + encodeURIComponent(CONFIG.GNEWS_API_KEY);

  // Do not force lang=en. Leaving language unset allows Arabic and English results.
  var countryCode = COUNTRY_CODES[region] || null;
  if (countryCode) apiUrl += "&country=" + encodeURIComponent(countryCode);

  return apiUrl;
}

async function fetchArticlesForQuery(query, dateFrom, dateTo, region, sortBy, page) {
  var url = buildApiUrl(query, dateFrom, dateTo, region, sortBy, page);

  var res = await fetchWithProxy(url);
  lastSearchRequestInfo.apiCalls += 1;
  recordApiRequest();

  if (!res.ok) {
    var errMsg = "HTTP " + res.status;
    try {
      var errData = await res.json();
      errMsg = extractApiErrorMessage(errData, errMsg);
    } catch (_) {}
    var error = new Error(errMsg);
    error.status = res.status;
    throw error;
  }

  var data = await res.json();
  return data.articles || [];
}

function extractApiErrorMessage(errData, fallback) {
  if (!errData || !errData.errors) return fallback;
  if (Array.isArray(errData.errors)) return errData.errors.join(" ");
  if (typeof errData.errors === "object") {
    return Object.keys(errData.errors).map(function(key) {
      return key + ": " + errData.errors[key];
    }).join(" ");
  }
  return String(errData.errors);
}

function mergeUniqueArticles(articleSets) {
  var seen = {};
  var merged = [];

  articleSets.forEach(function(set) {
    set.forEach(function(article) {
      var key = (article.url || article.title || "").toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      merged.push(article);
    });
  });

  return merged;
}

// ── Client-side filters ───────────────────────────────────────────────────────
function articleSearchText(article) {
  var sourceName = (article.source && article.source.name) ? article.source.name : "";
  var sourceUrl = (article.source && article.source.url) ? article.source.url : "";
  return (
    (article.title || "") + " " +
    (article.description || "") + " " +
    (article.content || "") + " " +
    (article.url || "") + " " +
    sourceName + " " + sourceUrl
  ).toLowerCase();
}

// GNews doesn't always respect region scope perfectly.
// After fetching, drop any article with zero MENA signals in its text/source/url.
function isMenaArticle(article) {
  var text = articleSearchText(article);
  for (var i = 0; i < MENA_COUNTRIES.length; i++) {
    if (text.indexOf(MENA_COUNTRIES[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

function matchesRelatedEnergyKeywords(article, userKeywords) {
  var text = articleSearchText(article);

  // If user has keywords, an article only needs to match those (handled by matchesKeywords).
  // For no-keyword searches, still require it to be energy-related.
  if (userKeywords.length > 0) return true;

  for (var i = 0; i < RELATED_ENERGY_KEYWORDS.length; i++) {
    if (text.indexOf(RELATED_ENERGY_KEYWORDS[i].toLowerCase()) !== -1) return true;
  }

  return false;
}

// When the user has added keywords, only show articles that match at least one.
function matchesKeywords(article, userKeywords) {
  if (userKeywords.length === 0) return true;
  var text = articleSearchText(article);
  for (var i = 0; i < userKeywords.length; i++) {
    if (text.indexOf(userKeywords[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

function matchesSourceWebsite(article, websites) {
  if (websites.length === 0) return true;

  var sourceUrl = (article.source && article.source.url) ? article.source.url : "";
  var urlText = ((article.url || "") + " " + sourceUrl).toLowerCase();

  for (var i = 0; i < websites.length; i++) {
    if (urlText.indexOf(websites[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

function matchesDateRange(article, dateFrom, dateTo) {
  if (!article.publishedAt) return false;
  var published = new Date(article.publishedAt);
  if (isNaN(published.getTime())) return false;

  var start = new Date(toRFC3339(dateFrom, false));
  var end = new Date(toRFC3339(dateTo, true));
  return published.getTime() >= start.getTime() && published.getTime() <= end.getTime();
}

function sortMergedArticles(articles, sortBy) {
  if (sortBy !== "publishedAt") return articles;
  return articles.slice().sort(function(a, b) {
    var aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    var bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function prioritizePreferredSources(articles, websites) {
  if (!websites.length) return articles;

  return articles.slice().sort(function(a, b) {
    var aMatch = matchesSourceWebsite(a, websites) ? 1 : 0;
    var bMatch = matchesSourceWebsite(b, websites) ? 1 : 0;
    return bMatch - aMatch;
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showSkeletons() {
  var html = "";
  for (var i = 0; i < 5; i++) {
    html += '<div class="loading-skeleton">' +
      '<div class="skel skel-sm"></div>' +
      '<div class="skel skel-title"></div>' +
      '<div class="skel skel-body"></div>' +
      '<div class="skel skel-body2"></div>' +
      '</div>';
  }
  document.getElementById("resultsArea").innerHTML = html;
}

function showError(msg) {
  document.getElementById("resultsArea").innerHTML =
    '<div class="error-box"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div>' + msg + '</div></div>';
}

function showEmpty(reason) {
  var note = reason || "Try a wider date range, a different region, fewer keywords, or fewer source websites.";
  document.getElementById("resultsArea").innerHTML =
    '<div class="empty-state"><i class="ti ti-news-off" aria-hidden="true"></i>' +
    '<p>No articles found for this search.<br>' + escHtml(note) + '</p></div>';
}

function setBtnLoading(loading) {
  var btn = document.getElementById("searchBtn");
  var label = document.getElementById("searchBtnLabel");
  if (loading) {
    btn.disabled = true;
    btn.classList.add("loading");
    btn.querySelector("i").className = "ti ti-loader-2 spin";
    label.textContent = "Searching...";
  } else {
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.querySelector("i").className = "ti ti-search";
    label.textContent = "Search news";
  }
}

function getSelectText(selectId) {
  var select = document.getElementById(selectId);
  if (!select || select.selectedIndex < 0) return "";
  return select.options[select.selectedIndex].text;
}

// ── Main search ───────────────────────────────────────────────────────────────
async function runSearch() {
  if (
    typeof CONFIG === "undefined" ||
    !CONFIG.GNEWS_API_KEY ||
    CONFIG.GNEWS_API_KEY === "YOUR_GNEWS_API_KEY_HERE"
  ) {
    showError('No API key found. Open <code>js/config.js</code>, paste your free GNews key, and reload.<br>' +
      'Get one free at <a href="https://gnews.io/register" target="_blank">gnews.io/register</a> (no credit card).');
    return;
  }

  var dateFrom = document.getElementById("dateFrom").value;
  var dateTo = document.getElementById("dateTo").value;
  var region = document.getElementById("regionFilter").value;
  var sortBy = document.getElementById("sortOrder").value;
  var strictSourceFilter = isStrictSourceMode();
  var deepRecall = isDeepSearchMode();

  if (!dateFrom || !dateTo) {
    showError("Please select both a start and end date.");
    return;
  }

  var startDate = parseDateInputUTC(dateFrom);
  var endDate = parseDateInputUTC(dateTo);
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    showError("The From date must be earlier than or equal to the To date.");
    return;
  }

  setBtnLoading(true);
  showSkeletons();

  var queries = buildQueries(region, keywords, deepRecall);
  var dateWindows = buildDateWindows(dateFrom, dateTo);
  var searchTasks = buildSearchTasks(queries, dateWindows, deepRecall);
  lastSearchRequestInfo = {
    apiCalls: 0,
    dateWindows: dateWindows.length,
    plannedCalls: searchTasks.length
  };

  try {
    var articleSets = [];
    for (var i = 0; i < searchTasks.length; i++) {
      if (i > 0) await sleep(GNEWS_FREE_RATE_DELAY_MS);
      var task = searchTasks[i];
      articleSets.push(await fetchArticlesForQuery(
        task.query, task.from, task.to, region, sortBy, task.page
      ));
    }

    var articles = sortMergedArticles(mergeUniqueArticles(articleSets), sortBy);

    // Enforce the selected date range client-side as a final guard.
    articles = articles.filter(function(a) {
      return matchesDateRange(a, dateFrom, dateTo);
    });

    // Final displayed results must pass the core filters.
    var menaArticles = articles.filter(isMenaArticle);
    var relatedArticles = menaArticles.filter(function(a) {
      return matchesRelatedEnergyKeywords(a, keywords);
    });
    var keywordArticles = relatedArticles.filter(function(a) {
      return matchesKeywords(a, keywords);
    });

    var preferredSourceArticles = keywordArticles.filter(function(a) {
      return matchesSourceWebsite(a, sourceWebsites);
    });

    var filtered = strictSourceFilter
      ? preferredSourceArticles
      : prioritizePreferredSources(keywordArticles, sourceWebsites);

    if (articles.length > 0 && menaArticles.length === 0) {
      showEmpty("GNews returned results, but none matched the MENA country/location filter. Arabic MENA terms are now included; try selecting a specific country or widening the date range.");
    } else if (menaArticles.length > 0 && relatedArticles.length === 0) {
      showEmpty("Found MENA articles, but none matched the energy and power relevance keywords. Try adding specific keywords or widen the date range.");
    } else if (relatedArticles.length > 0 && keywordArticles.length === 0) {
      showEmpty("Found MENA energy articles, but none matched your keywords. Try different or fewer keywords.");
    } else if (strictSourceFilter && keywordArticles.length > 0 && filtered.length === 0 && sourceWebsites.length > 0) {
      showEmpty("Found MENA energy articles, but none matched the selected source websites. Turn off strict source filtering, remove some websites, or widen the date range.");
    } else if (filtered.length === 0) {
      showEmpty("No articles found. Try a wider date range or different keywords.");
    } else {
      renderArticles(filtered, dateFrom, dateTo, region || "All MENA", sortBy, strictSourceFilter, queries, preferredSourceArticles.length, deepRecall, dateWindows);
    }

  } catch (err) {
    if (err.status === 401) {
      showError("Invalid API key (401). Check your key in <code>js/config.js</code>.");
    } else if (err.status === 403) {
      showError("Daily request quota reached (403). Try again after the quota resets, use another API key, or choose a shorter date range to reduce requests.");
    } else if (err.status === 429) {
      showError("GNews rate limit reached (429). The app already spaces requests apart; try the search again and keep Deep recall mode unchecked.");
    } else {
      showError("GNews/API network error: " + escHtml(err.message) + ". Make sure you are connected to the internet.");
    }
  }

  setBtnLoading(false);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderArticles(articles, dateFrom, dateTo, regionLabel, sortBy, strictSourceFilter, queries, preferredCount, deepRecall, dateWindows) {
  var area = document.getElementById("resultsArea");
  var sortLabel = sortBy === "publishedAt" ? "newest first" : "by relevance";
  var regionText = regionLabel === "All MENA" ? "All MENA" : getSelectText("regionFilter");
  var sourceMode = strictSourceFilter ? "strict" : "preferred";
  var requestMode = deepRecall ? "deep recall" : "quota saver";
  var apiInfo = lastSearchRequestInfo.apiCalls + " API call" + (lastSearchRequestInfo.apiCalls !== 1 ? "s" : "");
  var windowInfo = (dateWindows || []).map(function(window) {
    return window.from + "→" + window.to;
  }).join(" | ");

  var filterParts = [
    "region: " + escHtml(regionText || regionLabel),
    "keywords: " + (keywords.length ? keywords.map(escHtml).join(", ") : "none"),
    "sources: " + (sourceWebsites.length ? escHtml(sourceMode) + " / " + sourceWebsites.map(escHtml).join(", ") : "all"),
    "preferred source matches: " + escHtml(String(preferredCount || 0)),
    "request mode: " + escHtml(requestMode),
    "API usage: " + escHtml(apiInfo),
    "date windows: " + escHtml(String(lastSearchRequestInfo.dateWindows || 1)) + (windowInfo ? " (" + escHtml(windowInfo) + ")" : ""),
    "today API calls tracked: " + escHtml(String(getTodayRequestCount())),
    "date: " + escHtml(dateFrom) + " to " + escHtml(dateTo),
    "sort: " + escHtml(sortLabel),
    "queries: " + escHtml((queries || []).join(" | "))
  ];

  var html = '<div class="results-header"><span class="results-count">' +
    '<strong>' + articles.length + '</strong> article' + (articles.length !== 1 ? "s" : "") +
    ' &nbsp;&middot;&nbsp; ' + filterParts.join(' &nbsp;&middot;&nbsp; ') +
    '</span></div>';

  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];

    var pubDate = "Unknown date";
    if (a.publishedAt) {
      try {
        pubDate = new Date(a.publishedAt).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric"
        });
      } catch (_) { pubDate = a.publishedAt; }
    }

    var sourceName = (a.source && a.source.name) ? a.source.name : "Unknown";
    var sourceUrl = (a.source && a.source.url) ? a.source.url : "";
    var faviconUrl = sourceUrl || a.url || "";
    var faviconHtml = faviconUrl
      ? '<img src="https://www.google.com/s2/favicons?sz=16&domain_url=' + encodeURIComponent(faviconUrl) +
        '" width="13" height="13" alt="" style="border-radius:2px;vertical-align:-1px;margin-right:4px" />'
      : "";

    var articleText = articleSearchText(a);
    var matchedKw = keywords.filter(function(kw) { return articleText.indexOf(kw.toLowerCase()) !== -1; });
    var matchedDefaultKw = RELATED_ENERGY_KEYWORDS.filter(function(kw) { return articleText.indexOf(kw.toLowerCase()) !== -1; });
    var kwBadges = matchedKw.concat(matchedDefaultKw.slice(0, 3)).slice(0, 5).map(function(k) {
      return '<span class="kw-match">' + escHtml(k) + '</span>';
    }).join("");

    var preferredBadge = matchesSourceWebsite(a, sourceWebsites)
      ? '<span class="preferred-source-badge">Preferred source</span>'
      : "";

    var imgHtml = a.image
      ? '<img class="article-img" src="' + escAttr(a.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />'
      : "";

    var linkHtml = a.url
      ? '<a class="article-link" href="' + escAttr(a.url) + '" target="_blank" rel="noopener">' +
        '<i class="ti ti-external-link" aria-hidden="true"></i> Read full article</a>'
      : '<span style="font-size:13px;color:var(--text-3)">No link available</span>';

    html += '<article class="article-card">' +
      imgHtml +
      '<div class="article-body">' +
        '<div class="article-meta">' +
          '<span class="source-badge">' + faviconHtml + escHtml(sourceName) + '</span>' +
          preferredBadge +
          '<span class="article-date"><i class="ti ti-calendar" aria-hidden="true" style="font-size:13px"></i> ' + escHtml(pubDate) + '</span>' +
        '</div>' +
        '<div class="article-title">' + escHtml(a.title || "Untitled") + '</div>' +
        '<div class="article-summary">' + escHtml(a.description || "") + '</div>' +
        '<div class="article-footer">' +
          linkHtml +
          '<div class="keywords-matched">' + kwBadges + '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  area.innerHTML = html;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escAttr(str) {
  return escHtml(str);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  setDefaultDates();
  schedulePageRefresh();
  renderTags();
  renderSourceTags();

  document.getElementById("kwInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
  });
  document.getElementById("addKwBtn").addEventListener("click", addKeyword);
  document.getElementById("tagContainer").addEventListener("click", function(e) {
    var btn = e.target.closest(".tag-remove");
    if (btn) removeKeyword(btn.getAttribute("data-keyword"));
  });

  document.getElementById("sourceInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); addSourceWebsite(); }
  });
  document.getElementById("addSourceBtn").addEventListener("click", addSourceWebsite);
  document.getElementById("sourceContainer").addEventListener("click", function(e) {
    var btn = e.target.closest(".source-remove");
    if (btn) removeSourceWebsite(btn.getAttribute("data-domain"));
  });

  var strictSourceToggle = document.getElementById("strictSourceToggle");
  if (strictSourceToggle) {
    strictSourceToggle.addEventListener("change", renderFiltersPanel);
  }

  var deepSearchToggle = document.getElementById("deepSearchToggle");
  if (deepSearchToggle) {
    deepSearchToggle.addEventListener("change", renderFiltersPanel);
  }

  document.getElementById("searchBtn").addEventListener("click", runSearch);
  document.getElementById("showListsBtn").addEventListener("click", toggleFiltersPanel);

  if (
    typeof CONFIG !== "undefined" &&
    CONFIG.GNEWS_API_KEY &&
    CONFIG.GNEWS_API_KEY !== "YOUR_GNEWS_API_KEY_HERE"
  ) {
    document.getElementById("apiNotice").classList.add("hidden");
  }
});
