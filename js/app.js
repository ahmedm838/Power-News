// MENA Power & Energy News -- App Logic
// GNews.io free API + CORS proxy chain
// Search is locked to MENA + related energy/power keywords, with optional user keywords and preferred source domains.

var GNEWS_BASE = "https://gnews.io/api/v4/search";

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

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISODate(d) { return d.toISOString().slice(0, 10); }

function setDefaultDates() {
  var now = new Date();
  var week = new Date(now);
  week.setDate(now.getDate() - 7);
  document.getElementById("dateTo").value = toISODate(now);
  document.getElementById("dateFrom").value = toISODate(week);
}

function toRFC3339(dateStr, endOfDay) {
  return dateStr + (endOfDay ? "T23:59:59Z" : "T00:00:00Z");
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

function buildEnglishQuery(region, sector, userKeywords) {
  var parts = [];

  if (userKeywords.length > 0) {
    parts.push(userKeywords[0]);
    if (userKeywords.length > 1 && userKeywords[1].length < 30) parts.push(userKeywords[1]);
  } else if (sector) {
    parts.push(sector);
  } else {
    parts.push("energy electricity power");
  }

  if (sector && userKeywords.length > 0) {
    parts.push(sector);
  } else if (!sector && userKeywords.length > 0 && !hasArabic(userKeywords.join(" "))) {
    parts.push("energy electricity");
  }

  if (region) {
    parts.push(region);
  } else {
    parts.push("Middle East OR MENA");
  }

  return limitQuery(parts.join(" "));
}

function buildArabicQuery(region, sector, userKeywords) {
  var parts = [];
  var userText = userKeywords.join(" ").trim();

  if (userText && hasArabic(userText)) {
    parts.push(userText);
  } else if (sector && SECTOR_ARABIC_TERMS[sector]) {
    parts.push(SECTOR_ARABIC_TERMS[sector]);
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

function buildQueries(region, sector, userKeywords) {
  var queries = [];
  var userText = userKeywords.join(" ");

  uniquePush(queries, buildEnglishQuery(region, sector, userKeywords));
  uniquePush(queries, buildArabicQuery(region, sector, userKeywords));

  // Extra Arabic electricity-meter query improves recall for Arabic meter articles when the sector is broad.
  if (!userKeywords.length || hasArabic(userText) || sector === "electricity grid") {
    uniquePush(queries, limitQuery("عداد الكهرباء العدادات الذكية عدادات مسبقة الدفع " + (REGION_ARABIC_TERMS[region] || "مصر الشرق الأوسط")));
  }

  return queries.slice(0, 3);
}

function buildApiUrl(query, dateFrom, dateTo, region, sortBy) {
  var apiUrl = GNEWS_BASE +
    "?q=" + encodeURIComponent(query) +
    "&max=10" +
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

async function fetchArticlesForQuery(query, dateFrom, dateTo, region, sortBy) {
  var res = await fetchWithProxy(buildApiUrl(query, dateFrom, dateTo, region, sortBy));

  if (!res.ok) {
    var errMsg = "HTTP " + res.status;
    try {
      var errData = await res.json();
      if (errData.errors) errMsg = errData.errors.join(" ");
    } catch (_) {}
    var error = new Error(errMsg);
    error.status = res.status;
    throw error;
  }

  var data = await res.json();
  return data.articles || [];
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

function matchesRelatedEnergyKeywords(article, sector, userKeywords) {
  var text = articleSearchText(article);

  for (var i = 0; i < RELATED_ENERGY_KEYWORDS.length; i++) {
    if (text.indexOf(RELATED_ENERGY_KEYWORDS[i].toLowerCase()) !== -1) return true;
  }

  if (sector) {
    var sectorParts = sector.toLowerCase().split(/\s+/);
    for (var s = 0; s < sectorParts.length; s++) {
      if (sectorParts[s] && text.indexOf(sectorParts[s]) !== -1) return true;
    }
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
  var sector = document.getElementById("sectorFilter").value;
  var sortBy = document.getElementById("sortOrder").value;
  var strictSourceFilter = isStrictSourceMode();

  if (!dateFrom || !dateTo) {
    showError("Please select both a start and end date.");
    return;
  }

  setBtnLoading(true);
  showSkeletons();

  var queries = buildQueries(region, sector, keywords);

  try {
    var articleSets = [];
    for (var i = 0; i < queries.length; i++) {
      articleSets.push(await fetchArticlesForQuery(queries[i], dateFrom, dateTo, region, sortBy));
    }

    var articles = mergeUniqueArticles(articleSets);

    // Final displayed results must pass the core filters.
    var menaArticles = articles.filter(isMenaArticle);
    var relatedArticles = menaArticles.filter(function(a) {
      return matchesRelatedEnergyKeywords(a, sector, keywords);
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
      showEmpty("Found MENA articles, but none matched the default energy and power relevance keywords. Try another sector or wider date range.");
    } else if (relatedArticles.length > 0 && keywordArticles.length === 0) {
      showEmpty("Found MENA energy articles, but none matched your custom keywords. Try different or fewer keywords.");
    } else if (strictSourceFilter && keywordArticles.length > 0 && filtered.length === 0 && sourceWebsites.length > 0) {
      showEmpty("Found MENA energy articles, but none matched the selected source websites. Turn off strict source filtering, remove some websites, or widen the date range.");
    } else if (filtered.length === 0) {
      showEmpty("No articles found. Try a wider date range or different keywords.");
    } else {
      renderArticles(filtered, dateFrom, dateTo, region || "All MENA", sector || "All sectors", sortBy, strictSourceFilter, queries, preferredSourceArticles.length);
    }

  } catch (err) {
    if (err.status === 403) {
      showError("Invalid or expired API key (403). Check your key in <code>js/config.js</code>.");
    } else if (err.status === 429) {
      showError("Daily request limit reached (429). GNews free plan allows 100 requests/day. This version can run more than one query per search for Arabic + English recall.");
    } else {
      showError("GNews/API network error: " + escHtml(err.message) + ". Make sure you are connected to the internet.");
    }
  }

  setBtnLoading(false);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderArticles(articles, dateFrom, dateTo, regionLabel, sectorLabel, sortBy, strictSourceFilter, queries, preferredCount) {
  var area = document.getElementById("resultsArea");
  var sortLabel = sortBy === "publishedAt" ? "newest first" : "by relevance";
  var regionText = regionLabel === "All MENA" ? "All MENA" : getSelectText("regionFilter");
  var sectorText = sectorLabel === "All sectors" ? "All sectors" : getSelectText("sectorFilter");
  var sourceMode = strictSourceFilter ? "strict" : "preferred";

  var filterParts = [
    "region: " + escHtml(regionText || regionLabel),
    "sector: " + escHtml(sectorText || sectorLabel),
    "keywords: " + (keywords.length ? keywords.map(escHtml).join(", ") : "none"),
    "sources: " + (sourceWebsites.length ? escHtml(sourceMode) + " / " + sourceWebsites.map(escHtml).join(", ") : "all"),
    "preferred source matches: " + escHtml(String(preferredCount || 0)),
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
