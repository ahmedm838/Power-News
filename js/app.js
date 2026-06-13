// MENA Power & Energy News -- App Logic
// Uses GNews.io free API routed through a CORS proxy (required for browser)
// Docs: https://gnews.io/docs/v4

const GNEWS_BASE = "https://gnews.io/api/v4/search";

// CORS proxy chain -- tried in order until one succeeds.
// All of these are free and work from github.io and localhost.
const CORS_PROXIES = [
  (url) => "https://corsproxy.io/?url=" + encodeURIComponent(url),
  (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
  (url) => "https://corsmirror.onrender.com/v1/cors?url=" + encodeURIComponent(url),
];

// Fetch with automatic CORS proxy fallback.
async function fetchWithProxy(rawUrl) {
  var lastError = null;
  for (var i = 0; i < CORS_PROXIES.length; i++) {
    var proxiedUrl = CORS_PROXIES[i](rawUrl);
    try {
      var res = await fetch(proxiedUrl);
      if (res.status !== 0) return res;
    } catch (err) {
      lastError = err;
      console.warn("CORS proxy " + (i + 1) + " failed:", err.message);
    }
  }
  throw new Error(
    lastError
      ? "All proxies failed (" + lastError.message + "). Check your internet connection."
      : "All proxies failed. Check your internet connection."
  );
}

// Country to GNews country code mapping
var COUNTRY_CODES = {
  "egypt":        "eg",
  "saudi arabia": "sa",
  "UAE":          "ae",
  "iraq":         "iq",
  "iran":         "ir",
  "libya":        "ly",
  "algeria":      "dz",
  "morocco":      "ma",
  "jordan":       "jo",
  "kuwait":       "kw",
  "qatar":        "qa",
  "turkey":       "tr",
};

// Keyword state
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
    return '<span class="tag">' + escHtml(k) + '<button onclick="removeKeyword(\'' + k.replace(/'/g, "\\'") + '\')">x</button></span>';
  }).join("");
}

// Date helpers
function toISODate(d) { return d.toISOString().slice(0, 10); }

function setDefaultDates() {
  var now  = new Date();
  var week = new Date(now);
  week.setDate(now.getDate() - 7);
  document.getElementById("dateTo").value   = toISODate(now);
  document.getElementById("dateFrom").value = toISODate(week);
}

// GNews expects RFC3339: "2025-06-01T00:00:00Z"
function toRFC3339(dateStr, endOfDay) {
  return dateStr + (endOfDay ? "T23:59:59Z" : "T00:00:00Z");
}

// UI helpers
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

function showEmpty() {
  document.getElementById("resultsArea").innerHTML =
    '<div class="empty-state"><i class="ti ti-news-off" aria-hidden="true"></i>' +
    '<p>No articles found for this search.<br>Try a wider date range, a different region, or fewer keywords.</p></div>';
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

// Build a short, clean query that GNews free tier accepts (no complex booleans)
function buildQuery(region, sector, extraKeywords) {
  var terms = [];

  // Region: use country name or default to "Middle East"
  if (region) {
    terms.push(region);
  } else {
    terms.push("Middle East");
  }

  // Sector: use first word only to keep query short
  if (sector) {
    terms.push(sector.split(" ")[0]);
  } else {
    terms.push("energy");
  }

  // Extra keywords: max 2 to stay under query length limit
  var extras = extraKeywords.slice(0, 2);
  for (var i = 0; i < extras.length; i++) {
    terms.push(extras[i]);
  }

  return terms.join(" ");
}

// Main search
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

  // Build URL manually to keep full control of encoding
  var apiUrl = GNEWS_BASE +
    "?q="      + encodeURIComponent(query) +
    "&lang=en" +
    "&max=10"  +
    "&sortby=" + encodeURIComponent(sortBy) +
    "&from="   + encodeURIComponent(toRFC3339(dateFrom, false)) +
    "&to="     + encodeURIComponent(toRFC3339(dateTo, true)) +
    "&apikey=" + encodeURIComponent(CONFIG.GNEWS_API_KEY);

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
      } catch (_) {}

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

    if (articles.length === 0) {
      showEmpty();
    } else {
      renderArticles(articles, dateFrom, dateTo, region || "All MENA", sortBy);
    }

  } catch (err) {
    showError("Network error: " + err.message + ". Make sure you are connected to the internet.");
  }

  setBtnLoading(false);
}

// Render results
function renderArticles(articles, dateFrom, dateTo, regionLabel, sortBy) {
  var area      = document.getElementById("resultsArea");
  var sortLabel = sortBy === "publishedAt" ? "newest first" : "by relevance";

  var html = '<div class="results-header"><span class="results-count">' +
    '<strong>' + articles.length + '</strong> article' + (articles.length !== 1 ? "s" : "") +
    ' &nbsp;&middot;&nbsp; ' + escHtml(regionLabel) +
    ' &nbsp;&middot;&nbsp; ' + dateFrom + ' to ' + dateTo +
    ' &nbsp;&middot;&nbsp; ' + sortLabel +
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
    var sourceUrl  = (a.source && a.source.url)  ? a.source.url  : "";
    var faviconHtml = sourceUrl
      ? '<img src="https://www.google.com/s2/favicons?sz=16&domain_url=' + encodeURIComponent(sourceUrl) +
        '" width="13" height="13" alt="" style="border-radius:2px;vertical-align:-1px;margin-right:4px" />'
      : "";

    // Highlight matched user keywords
    var matchedKw = keywords.filter(function(kw) {
      return ((a.title || "") + " " + (a.description || "")).toLowerCase().indexOf(kw) !== -1;
    });
    var kwBadges = matchedKw.slice(0, 5).map(function(k) {
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
        '<div class="article-footer">' + linkHtml + '<div class="keywords-matched">' + kwBadges + '</div></div>' +
      '</div>' +
    '</article>';
  }

  area.innerHTML = html;
}

// Utilities
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Boot
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
