// ─────────────────────────────────────────────────────────────────────────────
//  MENA Power & Energy News — App Logic
//  Uses GNews.io free API routed through a CORS proxy (required for browser)
//  Docs: https://gnews.io/docs/v4
// ─────────────────────────────────────────────────────────────────────────────

const GNEWS_BASE = "https://gnews.io/api/v4/search";

// corsproxy.io is free for localhost — no account needed.
// It forwards the request server-side and adds CORS headers so the browser
// doesn't block it. We try two proxies in order; if the first is down, the
// second takes over automatically.
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// Fetch with automatic CORS proxy fallback
async function fetchWithProxy(rawUrl) {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxied = CORS_PROXIES[i](rawUrl);
    try {
      const res = await fetch(proxied);
      if (res.ok) return res;
      // Surface GNews-level errors (403, 429 etc.) on last attempt
      if (i === CORS_PROXIES.length - 1) return res;
    } catch (_) {
      if (i === CORS_PROXIES.length - 1) throw new Error("All proxies failed. Check your internet connection.");
    }
  }
}

// Country → GNews country code mapping
const COUNTRY_CODES = {
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

// ── Keyword state ─────────────────────────────────────────────────────────────
const keywords = [];

function addKeyword() {
  const input = document.getElementById("kwInput");
  const val   = input.value.trim().toLowerCase();
  if (!val || keywords.includes(val)) { input.value = ""; return; }
  keywords.push(val);
  renderTags();
  input.value = "";
  input.focus();
}

function removeKeyword(kw) {
  const idx = keywords.indexOf(kw);
  if (idx > -1) keywords.splice(idx, 1);
  renderTags();
}

function renderTags() {
  const c = document.getElementById("tagContainer");
  c.innerHTML = keywords
    .map(k => `<span class="tag">${escHtml(k)}<button onclick="removeKeyword('${k.replace(/'/g,"\\'")}')">×</button></span>`)
    .join("");
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISODate(d) { return d.toISOString().slice(0, 10); }

function setDefaultDates() {
  const now  = new Date();
  const week = new Date(now);
  week.setDate(now.getDate() - 7);
  document.getElementById("dateTo").value   = toISODate(now);
  document.getElementById("dateFrom").value = toISODate(week);
}

// GNews expects RFC3339: "2025-06-01T00:00:00Z"
function toRFC3339(dateStr, endOfDay = false) {
  return dateStr + (endOfDay ? "T23:59:59Z" : "T00:00:00Z");
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showSkeletons() {
  document.getElementById("resultsArea").innerHTML = [1,2,3,4,5].map(() => `
    <div class="loading-skeleton">
      <div class="skel skel-sm"></div>
      <div class="skel skel-title"></div>
      <div class="skel skel-body"></div>
      <div class="skel skel-body2"></div>
    </div>`).join("");
}

function showError(msg) {
  document.getElementById("resultsArea").innerHTML = `
    <div class="error-box">
      <i class="ti ti-alert-triangle" aria-hidden="true"></i>
      <div>${msg}</div>
    </div>`;
}

function showEmpty() {
  document.getElementById("resultsArea").innerHTML = `
    <div class="empty-state">
      <i class="ti ti-news-off" aria-hidden="true"></i>
      <p>No articles found for this search.<br>
         Try a wider date range, a different region, or fewer keywords.</p>
    </div>`;
}

function setBtnLoading(loading) {
  const btn   = document.getElementById("searchBtn");
  const label = document.getElementById("searchBtnLabel");
  if (loading) {
    btn.disabled = true;
    btn.classList.add("loading");
    btn.querySelector("i").className = "ti ti-loader-2 spin";
    label.textContent = "Searching…";
  } else {
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.querySelector("i").className = "ti ti-search";
    label.textContent = "Search news";
  }
}

// ── Build query string ────────────────────────────────────────────────────────
function buildQuery(region, sector, extraKeywords) {
  const parts = [];

  // Core energy terms
  parts.push("(energy OR electricity OR power OR oil OR \"natural gas\" OR renewables)");

  // Sector terms
  if (sector) parts.push(`(${sector})`);

  // Region term (if no country code available, embed in query)
  if (region && !COUNTRY_CODES[region]) {
    parts.push(region);
  }

  // For broad "all MENA" — add region context
  if (!region) {
    parts.push(
      "(\"Middle East\" OR MENA OR Egypt OR \"Saudi Arabia\" OR UAE OR Iraq OR Libya OR Algeria OR Morocco OR Jordan OR Kuwait OR Qatar OR Iran)"
    );
  }

  // Extra keywords from the chips
  if (extraKeywords.length > 0) {
    parts.push("(" + extraKeywords.join(" OR ") + ")");
  }

  return parts.join(" AND ");
}

// ── Main search ───────────────────────────────────────────────────────────────
async function runSearch() {
  // Guard: check API key
  if (
    typeof CONFIG === "undefined" ||
    !CONFIG.GNEWS_API_KEY ||
    CONFIG.GNEWS_API_KEY === "YOUR_GNEWS_API_KEY_HERE"
  ) {
    showError(
      `No API key found. Open <code>js/config.js</code>, paste your free GNews key, and reload.<br>
       Get one free at <a href="https://gnews.io/register" target="_blank">gnews.io/register</a> (no credit card).`
    );
    return;
  }

  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo   = document.getElementById("dateTo").value;
  const region   = document.getElementById("regionFilter").value;
  const sector   = document.getElementById("sectorFilter").value;
  const sortBy   = document.getElementById("sortOrder").value;

  if (!dateFrom || !dateTo) {
    showError("Please select both a start and end date.");
    return;
  }

  setBtnLoading(true);
  showSkeletons();

  const query       = buildQuery(region, sector, keywords);
  const countryCode = COUNTRY_CODES[region] || null;

  // GNews query params
  const params = new URLSearchParams({
    q:       query,
    lang:    "en",
    max:     10,
    sortby:  sortBy,
    from:    toRFC3339(dateFrom, false),
    to:      toRFC3339(dateTo,   true),
    apikey:  CONFIG.GNEWS_API_KEY,
  });

  // Only add country code when a specific country is selected
  if (countryCode) params.set("country", countryCode);

  const url = `${GNEWS_BASE}?${params.toString()}`;

  try {
    const res = await fetchWithProxy(url);

    if (!res.ok) {
      // Parse error message from GNews
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData.errors) errMsg = errData.errors.join(" ");
      } catch (_) {}

      if (res.status === 403) {
        showError(`Invalid or expired API key (403). Check your key in <code>js/config.js</code>.`);
      } else if (res.status === 429) {
        showError(`Daily request limit reached (429). GNews free plan allows 100 requests/day. Try again tomorrow.`);
      } else {
        showError(`GNews API error: ${errMsg}`);
      }
      setBtnLoading(false);
      return;
    }

    const data = await res.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      showEmpty();
    } else {
      renderArticles(articles, dateFrom, dateTo, region || "All MENA", sortBy);
    }

  } catch (err) {
    showError(`Network error: ${err.message}. Make sure you are connected to the internet.`);
  }

  setBtnLoading(false);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderArticles(articles, dateFrom, dateTo, regionLabel, sortBy) {
  const area = document.getElementById("resultsArea");

  const sortLabel = sortBy === "publishedAt" ? "newest first" : "by relevance";

  let html = `
    <div class="results-header">
      <span class="results-count">
        <strong>${articles.length}</strong> article${articles.length !== 1 ? "s" : ""}
        &nbsp;·&nbsp; ${escHtml(regionLabel)}
        &nbsp;·&nbsp; ${dateFrom} → ${dateTo}
        &nbsp;·&nbsp; ${sortLabel}
      </span>
    </div>`;

  articles.forEach(a => {
    // Format date nicely
    const pubDate = a.publishedAt
      ? new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "Unknown date";

    // Source name + favicon
    const sourceName = a.source?.name || "Unknown";
    const sourceUrl  = a.source?.url  || "";
    const faviconUrl = sourceUrl
      ? `https://www.google.com/s2/favicons?sz=16&domain_url=${encodeURIComponent(sourceUrl)}`
      : "";

    // Matched user keywords to highlight
    const matchedKw = keywords.filter(kw =>
      (a.title + " " + a.description).toLowerCase().includes(kw)
    );

    const kwBadges = matchedKw
      .slice(0, 5)
      .map(k => `<span class="kw-match">${escHtml(k)}</span>`)
      .join("");

    const img = a.image
      ? `<img class="article-img" src="${escHtml(a.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : "";

    html += `
      <article class="article-card">
        ${img}
        <div class="article-body">
          <div class="article-meta">
            <span class="source-badge">
              ${faviconUrl ? `<img src="${faviconUrl}" width="13" height="13" alt="" style="border-radius:2px;vertical-align:-1px;margin-right:4px" />` : ""}
              ${escHtml(sourceName)}
            </span>
            <span class="article-date">
              <i class="ti ti-calendar" aria-hidden="true" style="font-size:13px"></i>
              ${pubDate}
            </span>
          </div>
          <div class="article-title">${escHtml(a.title || "Untitled")}</div>
          <div class="article-summary">${escHtml(a.description || "")}</div>
          <div class="article-footer">
            ${a.url
              ? `<a class="article-link" href="${escHtml(a.url)}" target="_blank" rel="noopener">
                   <i class="ti ti-external-link" aria-hidden="true"></i> Read full article
                 </a>`
              : `<span style="font-size:13px;color:var(--text-3)">No link available</span>`
            }
            <div class="keywords-matched">${kwBadges}</div>
          </div>
        </div>
      </article>`;
  });

  area.innerHTML = html;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates();

  document.getElementById("kwInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
  });
  document.getElementById("addKwBtn").addEventListener("click", addKeyword);
  document.getElementById("searchBtn").addEventListener("click", runSearch);

  // Hide setup notice if key is already configured
  if (
    typeof CONFIG !== "undefined" &&
    CONFIG.GNEWS_API_KEY &&
    CONFIG.GNEWS_API_KEY !== "YOUR_GNEWS_API_KEY_HERE"
  ) {
    document.getElementById("apiNotice").classList.add("hidden");
  }
});
