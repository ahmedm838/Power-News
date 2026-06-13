// MENA Power & Energy News -- App Logic
// GNews.io free API + CORS proxy chain
// Narrowed: every search is locked to MENA region + optional keywords drive the query

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

// ── Keyword state ─────────────────────────────────────────────────────────────
var keywords = [];

function addKeyword() {
  var input = document.getElementById("kwInput");
  var val = input.value.trim().toLowerCase();
  if (!val || keywords.indexOf(val) !== -1) { input.value = ""; return; }
  keywords.push(val);
  renderTags();
  input.value = "";
  input.focus();
}

function removeKeyword(kw) {
  var idx = keywords.indexOf(kw);
  if (idx > -1) keywords.splice(idx, 1);
  renderTags();
}

function renderTags() {
  var c = document.getElementById("tagContainer");
  c.innerHTML = keywords.map(function(k) {
    return '<span class="tag">' + escHtml(k) +
      '<button onclick="removeKeyword(\'' + k.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')">x</button></span>';
  }).join("");
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
//   - Always include a MENA region anchor so GNews returns regional news
//   - If user added keywords, lead with those (they become the primary search)
//   - If a specific country is selected, use that instead of "Middle East"
//   - If a sector is selected, add it
//   - Keep total query short (<80 chars) to avoid GNews 400 errors
function buildQuery(region, sector, userKeywords) {
  var parts = [];

  // 1. User keywords are primary — use first keyword as lead term if present
  if (userKeywords.length > 0) {
    parts.push(userKeywords[0]);
    // Add second keyword if short enough
    if (userKeywords.length > 1 && userKeywords[1].length < 20) {
      parts.push(userKeywords[1]);
    }
  } else if (sector) {
    // No keywords: use sector as primary search term
    parts.push(sector.split(" ")[0]);
  } else {
    // Pure default: search for energy news
    parts.push("energy");
  }

  // 2. MENA anchor — always present
  if (region) {
    parts.push(region);           // e.g. "Egypt", "Saudi Arabia"
  } else {
    parts.push("Middle East");    // broad MENA anchor
  }

  return parts.join(" ");
}

// ── Client-side MENA filter ───────────────────────────────────────────────────
// GNews doesn't always respect region scope perfectly on free tier.
// After fetching, we drop any article with zero MENA signals in its text.
function isMenaArticle(article) {
  var text = ((article.title || "") + " " + (article.description || "")).toLowerCase();
  for (var i = 0; i < MENA_COUNTRIES.length; i++) {
    if (text.indexOf(MENA_COUNTRIES[i]) !== -1) return true;
  }
  return false;
}

// ── Client-side keyword filter ────────────────────────────────────────────────
// When the user has added keywords, only show articles that match at least one.
function matchesKeywords(article, userKeywords) {
  if (userKeywords.length === 0) return true; // no filter
  var text = ((article.title || "") + " " + (article.description || "")).toLowerCase();
  for (var i = 0; i < userKeywords.length; i++) {
    if (text.indexOf(userKeywords[i]) !== -1) return true;
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
  var note = reason || "Try a wider date range, a different region, or fewer keywords.";
  document.getElementById("resultsArea").innerHTML =
    '<div class="empty-state"><i class="ti ti-news-off" aria-hidden="true"></i>' +
    '<p>No articles found for this search.<br>' + note + '</p></div>';
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

  // Use country code when a specific country is selected
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
        showError("GNews API error: " + errMsg);
      }
      setBtnLoading(false);
      return;
    }

    var data     = await res.json();
    var articles = data.articles || [];

    // Step 1: filter to MENA-only articles
    var menaArticles = articles.filter(isMenaArticle);

    // Step 2: if user added keywords, only show articles matching them
    var filtered = menaArticles.filter(function(a) {
      return matchesKeywords(a, keywords);
    });

    if (articles.length > 0 && menaArticles.length === 0) {
      showEmpty("GNews returned results but none were from the Middle East or North Africa. Try selecting a specific country.");
    } else if (menaArticles.length > 0 && filtered.length === 0) {
      showEmpty("Found " + menaArticles.length + " MENA article(s) but none matched your keywords. Try different or fewer keywords.");
    } else if (filtered.length === 0) {
      showEmpty("No articles found. Try a wider date range or different keywords.");
    } else {
      renderArticles(filtered, dateFrom, dateTo, region || "All MENA", sortBy);
    }

  } catch (err) {
    showError("Network error: " + err.message + ". Make sure you are connected to the internet.");
  }

  setBtnLoading(false);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderArticles(articles, dateFrom, dateTo, regionLabel, sortBy) {
  var area      = document.getElementById("resultsArea");
  var sortLabel = sortBy === "publishedAt" ? "newest first" : "by relevance";

  // Build filter summary line
  var filterParts = [escHtml(regionLabel)];
  if (keywords.length > 0) filterParts.push("keywords: " + keywords.map(escHtml).join(", "));
  filterParts.push(dateFrom + " to " + dateTo);
  filterParts.push(sortLabel);

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
    var faviconHtml = sourceUrl
      ? '<img src="https://www.google.com/s2/favicons?sz=16&domain_url=' + encodeURIComponent(sourceUrl) +
        '" width="13" height="13" alt="" style="border-radius:2px;vertical-align:-1px;margin-right:4px" />'
      : "";

    // Show which user keywords matched in this article
    var articleText = ((a.title || "") + " " + (a.description || "")).toLowerCase();
    var matchedKw   = keywords.filter(function(kw) { return articleText.indexOf(kw) !== -1; });
    var kwBadges    = matchedKw.slice(0,5).map(function(k) {
      return '<span class="kw-match">' + escHtml(k) + '</span>';
    }).join("");

    var imgHtml = a.image
      ? '<img class="article-img" src="' + escHtml(a.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />'
      : "";

    var linkHtml = a.url
      ? '<a class="article-link" href="' + escHtml(a.url) + '" target="_blank" rel="noopener">' +
        '<i class="ti ti-external-link" aria-hidden="true"></i> Read full article</a>'
      : '<span style="font-size:13px;color:var(--text-3)">No link available</span>';

    html += '<article class="article-card">' +
      imgHtml +
      '<div class="article-body">' +
        '<div class="article-meta">' +
          '<span class="source-badge">' + faviconHtml + escHtml(sourceName) + '</span>' +
          '<span class="article-date"><i class="ti ti-calendar" aria-hidden="true" style="font-size:13px"></i> ' + pubDate + '</span>' +
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
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  setDefaultDates();
  document.getElementById("kwInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
  });
  document.getElementById("addKwBtn").addEventListener("click", addKeyword);
  document.getElementById("searchBtn").addEventListener("click", runSearch);

  if (
    typeof CONFIG !== "undefined" &&
    CONFIG.GNEWS_API_KEY &&
    CONFIG.GNEWS_API_KEY !== "YOUR_GNEWS_API_KEY_HERE"
  ) {
    document.getElementById("apiNotice").classList.add("hidden");
  }
});
