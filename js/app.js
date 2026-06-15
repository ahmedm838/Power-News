// MENA Power & Energy News -- App Logic
// GNews.io free API + CORS proxy chain
// Search is locked to MENA + related energy/power keywords, with optional user keywords and source domains.

var GNEWS_BASE = "https://gnews.io/api/v4/search";

// ── MENA geography ────────────────────────────────────────────────────────────
// All country names used for result filtering (client-side)
var MENA_COUNTRIES = [
  "egypt","saudi arabia","saudi","uae","united arab emirates","iraq","iran",
  "libya","algeria","morocco","jordan","kuwait","qatar","turkey","oman","bahrain",
  "yemen","tunisia","sudan","syria","lebanon","palestine","israel","gaza",
  "west bank","sinai","persian gulf","arabian gulf","red sea","nile",
  "middle east","north africa","mena","gulf","levant","maghreb"
];

// Country filter dropdown -> GNews country code
var COUNTRY_CODES = {
  "egypt":"eg","saudi arabia":"sa","UAE":"ae","iraq":"iq","iran":"ir",
  "libya":"ly","algeria":"dz","morocco":"ma","jordan":"jo",
  "kuwait":"kw","qatar":"qa","turkey":"tr"
};

// Fixed relevance list used to reject unrelated general news.
// Keep terms lowercase because matching is case-insensitive.
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
  "petroleum", "refinery", "pipeline", "hydrogen", "green hydrogen"
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
      console.warn("Proxy " + (i+1) + " failed:", err.message);
    }
  }
  throw new Error(lastError ? "All proxies failed (" + lastError.message + ")." : "All proxies failed.");
}

// ── Keyword and source website state ─────────────────────────────────────────
var keywords = [];
var sourceWebsites = [];
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
function toISODate(d) { return d.toISOString().slice(0,10); }

function setDefaultDates() {
  var now = new Date();
  var week = new Date(now);
  week.setDate(now.getDate() - 7);
  document.getElementById("dateTo").value   = toISODate(now);
  document.getElementById("dateFrom").value = toISODate(week);
}

function toRFC3339(dateStr, endOfDay) {
  return dateStr + (endOfDay ? "T23:59:59Z" : "T00:00:00Z");
}

// ── Query builder ─────────────────────────────────────────────────────────────
// Strategy:
//   - Lead with user keywords or selected sector when present.
//   - Always include an energy/power anchor.
//   - Add the selected MENA country or a broad Middle East anchor.
//   - Keep total query short to avoid GNews 400 errors.
function buildQuery(region, sector, userKeywords) {
  var parts = [];

  if (userKeywords.length > 0) {
    parts.push(userKeywords[0]);
    if (userKeywords.length > 1 && userKeywords[1].length < 20) {
      parts.push(userKeywords[1]);
    }
  } else if (sector) {
    parts.push(sector);
  } else {
    parts.push("energy electricity");
  }

  if (sector && userKeywords.length > 0) {
    parts.push(sector);
  } else if (!sector && userKeywords.length > 0) {
    parts.push("energy");
  }

  if (region) {
    parts.push(region);
  } else {
    parts.push("Middle East");
  }

  return parts.join(" ").slice(0, 110);
}

// ── Client-side filters ───────────────────────────────────────────────────────
function articleSearchText(article) {
  var sourceName = (article.source && article.source.name) ? article.source.name : "";
  var sourceUrl  = (article.source && article.source.url)  ? article.source.url  : "";
  return (
    (article.title || "") + " " +
    (article.description || "") + " " +
    (article.content || "") + " " +
    (article.url || "") + " " +
    sourceName + " " + sourceUrl
  ).toLowerCase();
}

// GNews doesn't always respect region scope perfectly on free tier.
// After fetching, drop any article with zero MENA signals in its text/source/url.
function isMenaArticle(article) {
  var text = articleSearchText(article);
  for (var i = 0; i < MENA_COUNTRIES.length; i++) {
    if (text.indexOf(MENA_COUNTRIES[i]) !== -1) return true;
  }
  return false;
}

function matchesRelatedEnergyKeywords(article, sector, userKeywords) {
  var text = articleSearchText(article);

  for (var i = 0; i < RELATED_ENERGY_KEYWORDS.length; i++) {
    if (text.indexOf(RELATED_ENERGY_KEYWORDS[i]) !== -1) return true;
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
    if (text.indexOf(userKeywords[i]) !== -1) return true;
  }
  return false;
}

function matchesSourceWebsite(article, websites) {
  if (websites.length === 0) return true;

  var sourceUrl = (article.source && article.source.url) ? article.source.url : "";
  var urlText = ((article.url || "") + " " + sourceUrl).toLowerCase();

  for (var i = 0; i < websites.length; i++) {
    if (urlText.indexOf(websites[i]) !== -1) return true;
  }
  return false;
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
  var btn   = document.getElementById("searchBtn");
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
  var dateTo   = document.getElementById("dateTo").value;
  var region   = document.getElementById("regionFilter").value;
  var sector   = document.getElementById("sectorFilter").value;
  var sortBy   = document.getElementById("sortOrder").value;

  if (!dateFrom || !dateTo) {
    showError("Please select both a start and end date.");
    return;
  }

  setBtnLoading(true);
  showSkeletons();

  var query       = buildQuery(region, sector, keywords);
  var countryCode = COUNTRY_CODES[region] || null;

  var apiUrl = GNEWS_BASE +
    "?q="      + encodeURIComponent(query) +
    "&lang=en" +
    "&max=10"  +
    "&sortby=" + encodeURIComponent(sortBy) +
    "&from="   + encodeURIComponent(toRFC3339(dateFrom, false)) +
    "&to="     + encodeURIComponent(toRFC3339(dateTo, true)) +
    "&apikey=" + encodeURIComponent(CONFIG.GNEWS_API_KEY);

  // Use country code when a specific country is selected.
  if (countryCode) {
    apiUrl += "&country=" + encodeURIComponent(countryCode);
  }

  try {
    var res = await fetchWithProxy(apiUrl);

    if (!res.ok) {
      var errMsg = "HTTP " + res.status;
      try {
        var errData = await res.json();
        if (errData.errors) errMsg = errData.errors.join(" ");
      } catch(_) {}

      if (res.status === 403) {
        showError("Invalid or expired API key (403). Check your key in <code>js/config.js</code>.");
      } else if (res.status === 429) {
        showError("Daily request limit reached (429). GNews free plan allows 100 requests/day. Try again tomorrow.");
      } else {
        showError("GNews API error: " + escHtml(errMsg));
      }
      setBtnLoading(false);
      return;
    }

    var data     = await res.json();
    var articles = data.articles || [];

    // Final displayed results must pass all applicable filters.
    var menaArticles = articles.filter(isMenaArticle);
    var relatedArticles = menaArticles.filter(function(a) {
      return matchesRelatedEnergyKeywords(a, sector, keywords);
    });
    var keywordArticles = relatedArticles.filter(function(a) {
      return matchesKeywords(a, keywords);
    });
    var filtered = keywordArticles.filter(function(a) {
      return matchesSourceWebsite(a, sourceWebsites);
    });

    if (articles.length > 0 && menaArticles.length === 0) {
      showEmpty("GNews returned results, but none were from the Middle East or North Africa. Try selecting a specific country.");
    } else if (menaArticles.length > 0 && relatedArticles.length === 0) {
      showEmpty("Found MENA articles, but none matched the default energy and power relevance keywords. Try another sector or wider date range.");
    } else if (relatedArticles.length > 0 && keywordArticles.length === 0) {
      showEmpty("Found MENA energy articles, but none matched your custom keywords. Try different or fewer keywords.");
    } else if (keywordArticles.length > 0 && filtered.length === 0 && sourceWebsites.length > 0) {
      showEmpty("Found MENA energy articles, but none matched the selected source websites. Try removing some websites or widening the date range.");
    } else if (filtered.length === 0) {
      showEmpty("No articles found. Try a wider date range or different keywords.");
    } else {
      renderArticles(filtered, dateFrom, dateTo, region || "All MENA", sector || "All sectors", sortBy);
    }

  } catch (err) {
    showError("Network error: " + escHtml(err.message) + ". Make sure you are connected to the internet.");
  }

  setBtnLoading(false);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderArticles(articles, dateFrom, dateTo, regionLabel, sectorLabel, sortBy) {
  var area      = document.getElementById("resultsArea");
  var sortLabel = sortBy === "publishedAt" ? "newest first" : "by relevance";
  var regionText = regionLabel === "All MENA" ? "All MENA" : getSelectText("regionFilter");
  var sectorText = sectorLabel === "All sectors" ? "All sectors" : getSelectText("sectorFilter");

  // Build filter summary line.
  var filterParts = [
    "region: " + escHtml(regionText || regionLabel),
    "sector: " + escHtml(sectorText || sectorLabel),
    "keywords: " + (keywords.length ? keywords.map(escHtml).join(", ") : "none"),
    "sources: " + (sourceWebsites.length ? sourceWebsites.map(escHtml).join(", ") : "all"),
    "date: " + escHtml(dateFrom) + " to " + escHtml(dateTo),
    "sort: " + escHtml(sortLabel)
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
      } catch(_) { pubDate = a.publishedAt; }
    }

    var sourceName  = (a.source && a.source.name) ? a.source.name : "Unknown";
    var sourceUrl   = (a.source && a.source.url)  ? a.source.url  : "";
    var faviconUrl  = sourceUrl || a.url || "";
    var faviconHtml = faviconUrl
      ? '<img src="https://www.google.com/s2/favicons?sz=16&domain_url=' + encodeURIComponent(faviconUrl) +
        '" width="13" height="13" alt="" style="border-radius:2px;vertical-align:-1px;margin-right:4px" />'
      : "";

    var articleText = articleSearchText(a);
    var matchedKw   = keywords.filter(function(kw) { return articleText.indexOf(kw) !== -1; });
    var kwBadges    = matchedKw.slice(0,5).map(function(k) {
      return '<span class="kw-match">' + escHtml(k) + '</span>';
    }).join("");

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
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function escAttr(str) {
  return escHtml(str);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  setDefaultDates();

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
