// Same-origin Al Mal index fallback.
// Browser-side scraping is unreliable because Al Mal and public CORS proxies can
// block article/listing HTML. This reads a local JSON index from this repo.
(function() {
  if (typeof runSearch !== "function") return;

  var originalRunSearch = runSearch;
  var ALMAL_DOMAIN = "almalnews.com";
  var INDEX_URL = "data/almalnews.json";

  runSearch = async function() {
    await originalRunSearch();
    await appendAlmalIndexedResults();
  };

  async function appendAlmalIndexedResults() {
    var dateFrom = document.getElementById("dateFrom").value;
    var dateTo = document.getElementById("dateTo").value;
    var region = document.getElementById("regionFilter").value;
    var sortBy = document.getElementById("sortOrder").value;

    if (!dateFrom || !dateTo || !matchesAlmalRegion(region) || !shouldUseAlmalIndex()) return;

    try {
      var res = await fetch(INDEX_URL + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);

      var data = await res.json();
      var filtered = (data.articles || [])
        .map(normalizeIndexedArticle)
        .filter(function(article) { return !isAlreadyRendered(article.url); })
        .filter(function(article) { return matchesDateRange(article, dateFrom, dateTo); })
        .filter(function(article) { return matchesRelatedEnergyKeywords(article, keywords); })
        .filter(function(article) { return matchesKeywords(article, keywords); });

      if (!filtered.length) return;

      filtered = sortMergedArticles(filtered, sortBy);
      appendIndexedArticleCards(filtered);
      window.almalStaticIndexInfo = { loaded: data.articles.length, appended: filtered.length };
    } catch (err) {
      window.almalStaticIndexInfo = { error: err.message };
      console.warn("Al Mal static index failed:", err.message);
    }
  }

  function shouldUseAlmalIndex() {
    var hasAlmal = Array.isArray(sourceWebsites) && sourceWebsites.some(function(domain) {
      return normalizeDomain(domain) === ALMAL_DOMAIN;
    });

    return hasAlmal || !isStrictSourceMode();
  }

  function matchesAlmalRegion(region) {
    return !region || region === "egypt";
  }

  function normalizeIndexedArticle(article) {
    return {
      title: article.title || "",
      description: article.description || "",
      content: [
        "\u0645\u0635\u0631 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0642\u0648\u0645\u064a\u0629",
        article.keywords || "",
        article.content || ""
      ].join(" "),
      url: article.url || "",
      image: article.image || "",
      publishedAt: article.publishedAt || "",
      source: {
        name: article.sourceName || "\u062c\u0631\u064a\u062f\u0629 \u0627\u0644\u0645\u0627\u0644",
        url: "https://almalnews.com"
      },
      provider: "Al Mal index"
    };
  }

  function isAlreadyRendered(url) {
    if (!url) return false;
    var links = Array.prototype.slice.call(document.querySelectorAll("#resultsArea a[href]"));
    return links.some(function(link) {
      return normalizeRenderedUrl(link.href) === normalizeRenderedUrl(url);
    });
  }

  function normalizeRenderedUrl(url) {
    var clean = String(url || "").split("?")[0].replace(/\/$/, "");
    try { clean = decodeURI(clean); } catch (_) {}
    return clean;
  }

  function appendIndexedArticleCards(articles) {
    var area = document.getElementById("resultsArea");
    if (!area) return;

    var empty = area.querySelector(".empty-state");
    if (empty) area.innerHTML = "";

    var html = '<div class="results-header direct-source-header"><span class="results-count">' +
      '<strong>' + articles.length + '</strong> indexed Al Mal article' + (articles.length !== 1 ? "s" : "") +
      '</span></div>';

    articles.forEach(function(article) {
      html += renderIndexedArticleCard(article);
    });

    area.insertAdjacentHTML("beforeend", html);
  }

  function renderIndexedArticleCard(a) {
    var pubDate = "Unknown date";
    if (a.publishedAt) {
      try {
        pubDate = new Date(a.publishedAt).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric"
        });
      } catch (_) { pubDate = a.publishedAt; }
    }

    var articleText = articleSearchText(a);
    var matchedKw = keywords.filter(function(kw) { return articleText.indexOf(kw.toLowerCase()) !== -1; });
    var matchedDefaultKw = RELATED_ENERGY_KEYWORDS.filter(function(kw) { return articleText.indexOf(kw.toLowerCase()) !== -1; });
    var kwBadges = matchedKw.concat(matchedDefaultKw.slice(0, 3)).slice(0, 5).map(function(k) {
      return '<span class="kw-match">' + escHtml(k) + '</span>';
    }).join("");
    var imgHtml = a.image
      ? '<img class="article-img" src="' + escAttr(a.image) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\'" />'
      : "";

    return '<article class="article-card">' +
      imgHtml +
      '<div class="article-body">' +
        '<div class="article-meta">' +
          '<span class="source-badge"><img src="https://www.google.com/s2/favicons?sz=16&domain_url=' + encodeURIComponent(a.source.url) + '" width="13" height="13" alt="" style="border-radius:2px;vertical-align:-1px;margin-right:4px" />' + escHtml(a.source.name) + '</span>' +
          '<span class="preferred-source-badge">Indexed source</span>' +
          '<span class="article-date"><i class="ti ti-calendar" aria-hidden="true" style="font-size:13px"></i> ' + escHtml(pubDate) + '</span>' +
        '</div>' +
        '<div class="article-title">' + escHtml(a.title || "Untitled") + '</div>' +
        '<div class="article-summary">' + escHtml(a.description || "") + '</div>' +
        '<div class="article-footer">' +
          '<a class="article-link" href="' + escAttr(a.url) + '" target="_blank" rel="noopener">' +
            '<i class="ti ti-external-link" aria-hidden="true"></i> Read full article</a>' +
          '<div class="keywords-matched">' + kwBadges + '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
})();
