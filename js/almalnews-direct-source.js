// Direct Al Mal News fallback.
// Some Arabic Al Mal articles are not indexed by GNews/NewsAPI, even when
// almalnews.com is in the source list. This fetches Al Mal's own tag pages,
// extracts article URLs, then reads article metadata directly.
(function() {
  if (typeof runSearch !== "function") return;

  var originalRunSearch = runSearch;
  var ALMAL_DOMAIN = "almalnews.com";
  var ALMAL_BASE = "https://almalnews.com";
  var ALMAL_MAX_LIST_PAGES = 3;
  var ALMAL_MAX_ARTICLES_TO_READ = 60;

  var ALMAL_TAGS = [
    "\u0648\u0632\u0627\u0631\u0629-\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    "\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    "\u0637\u0627\u0642\u0629",
    "\u0648\u0632\u064a\u0631-\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    "\u0627\u0644\u0634\u0628\u0643\u0629-\u0627\u0644\u0642\u0648\u0645\u064a\u0629-\u0644\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    "\u0627\u0644\u0642\u0627\u0628\u0636\u0629-\u0644\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    "\u0627\u0644\u0642\u0627\u0628\u0636\u0629-\u0644\u0643\u0647\u0631\u0628\u0627\u0621-\u0645\u0635\u0631",
    "\u0639\u062f\u0627\u062f\u0627\u062a-\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    "\u0627\u0644\u0637\u0627\u0642\u0629-\u0627\u0644\u0645\u062a\u062c\u062f\u062f\u0629"
  ];

  runSearch = async function() {
    await originalRunSearch();
    await appendAlmalDirectResults();
  };

  function isAlmalEnabled() {
    if (!Array.isArray(sourceWebsites)) return false;
    return sourceWebsites.some(function(domain) {
      return normalizeDomain(domain) === ALMAL_DOMAIN;
    });
  }

  function shouldSearchAlmalForRegion(region) {
    return !region || region === "egypt";
  }

  async function appendAlmalDirectResults() {
    if (!isAlmalEnabled()) return;

    var dateFrom = document.getElementById("dateFrom").value;
    var dateTo = document.getElementById("dateTo").value;
    var region = document.getElementById("regionFilter").value;
    var sortBy = document.getElementById("sortOrder").value;

    if (!dateFrom || !dateTo || !shouldSearchAlmalForRegion(region)) return;

    try {
      var directArticles = await fetchAlmalDirectArticles(dateFrom, dateTo);
      var filtered = directArticles
        .filter(function(article) { return !isAlreadyRendered(article.url); })
        .filter(function(article) { return matchesDateRange(article, dateFrom, dateTo); })
        .filter(function(article) { return matchesAlmalRegion(region); })
        .filter(function(article) { return matchesRelatedEnergyKeywords(article, keywords); })
        .filter(function(article) { return matchesKeywords(article, keywords); });

      if (!filtered.length) return;

      filtered = sortMergedArticles(filtered, sortBy);
      appendDirectArticleCards(filtered);
    } catch (err) {
      console.warn("Al Mal direct source failed:", err.message);
    }
  }

  async function fetchAlmalDirectArticles(dateFrom, dateTo) {
    var urls = await discoverAlmalArticleUrls();
    var articles = [];

    for (var i = 0; i < urls.length && articles.length < ALMAL_MAX_ARTICLES_TO_READ; i++) {
      try {
        var article = await fetchAlmalArticleMetadata(urls[i]);
        if (article && matchesDateRange(article, dateFrom, dateTo)) {
          articles.push(article);
        }
      } catch (err) {
        console.warn("Could not read Al Mal article:", urls[i], err.message);
      }
    }

    return articles;
  }

  async function discoverAlmalArticleUrls() {
    var seen = {};
    var urls = [];

    for (var t = 0; t < ALMAL_TAGS.length; t++) {
      for (var page = 1; page <= ALMAL_MAX_LIST_PAGES; page++) {
        var listUrl = ALMAL_BASE + "/tag/" + encodeURIComponent(ALMAL_TAGS[t]) + "/" + page + "/";
        try {
          var html = await fetchTextThroughAllRoutes(listUrl);
          extractAlmalUrls(html).forEach(function(url) {
            if (!seen[url]) {
              seen[url] = true;
              urls.push(url);
            }
          });
        } catch (err) {
          console.warn("Could not read Al Mal tag page:", listUrl, err.message);
        }
      }
    }

    return urls;
  }

  function extractAlmalUrls(html) {
    var urls = [];
    var seen = {};
    var matches = String(html || "").match(/https:\/\/almalnews\.com\/\d+\/[^"'<>\s]+\/?/g) || [];

    matches.forEach(function(rawUrl) {
      var clean = rawUrl.split("?")[0].split("#")[0];
      if (!seen[clean]) {
        seen[clean] = true;
        urls.push(clean);
      }
    });

    return urls;
  }

  function matchesAlmalRegion(region) {
    // Al Mal is an Egyptian source. Do not drop its electricity ministry items
    // just because the title/summary does not literally say Egypt/Cairo.
    return !region || region === "egypt";
  }

  async function fetchAlmalArticleMetadata(url) {
    var html = await fetchTextThroughAllRoutes(url);
    var doc = new DOMParser().parseFromString(html, "text/html");
    var title = readMeta(doc, "property", "og:title") || readText(doc, "title");
    var description = readMeta(doc, "name", "description") || readMeta(doc, "property", "og:description");
    var image = readMeta(doc, "property", "og:image");
    var publishedAt = readMeta(doc, "property", "article:published_time");
    var canonical = readCanonical(doc) || url;

    var jsonArticle = readNewsArticleJson(doc);
    if (jsonArticle) {
      title = jsonArticle.headline || title;
      description = jsonArticle.description || description;
      publishedAt = jsonArticle.datePublished || publishedAt;
      image = readJsonImage(jsonArticle.image) || image;
      canonical = jsonArticle["@id"] || canonical;
    }

    if (!title || !publishedAt) return null;

    return {
      title: cleanAlmalTitle(title),
      description: description || "",
      content: [
        "\u0645\u0635\u0631 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0642\u0648\u0645\u064a\u0629",
        collectMetaKeywords(doc),
        collectArticleText(doc)
      ].join(" "),
      url: canonical,
      image: image || "",
      publishedAt: normalizeAlmalDate(publishedAt),
      source: {
        name: "\u062c\u0631\u064a\u062f\u0629 \u0627\u0644\u0645\u0627\u0644",
        url: ALMAL_BASE
      },
      provider: "Al Mal direct"
    };
  }

  async function fetchTextThroughAllRoutes(url) {
    var errors = [];

    if (Array.isArray(CORS_PROXIES)) {
      for (var i = 0; i < CORS_PROXIES.length; i++) {
        try {
          var proxied = CORS_PROXIES[i](url);
          var proxyRes = await fetch(proxied);
          if (proxyRes.ok) return await proxyRes.text();
          errors.push("proxy " + (i + 1) + " HTTP " + proxyRes.status);
        } catch (err) {
          errors.push("proxy " + (i + 1) + " " + err.message);
        }
      }
    }

    try {
      var directRes = await fetch(url);
      if (directRes.ok) return await directRes.text();
      errors.push("direct HTTP " + directRes.status);
    } catch (directErr) {
      errors.push("direct " + directErr.message);
    }

    throw new Error(errors.join("; ") || "No Al Mal response");
  }

  function collectMetaKeywords(doc) {
    var values = [];
    Array.prototype.slice.call(doc.querySelectorAll("meta[name='keywords'], meta[property='article:tag']")).forEach(function(meta) {
      var value = (meta.getAttribute("content") || "").trim();
      if (value && values.indexOf(value) === -1) values.push(value);
    });
    return values.join(" ");
  }

  function readMeta(doc, attr, value) {
    var el = doc.querySelector("meta[" + attr + "='" + value + "']");
    return el ? (el.getAttribute("content") || "").trim() : "";
  }

  function readText(doc, selector) {
    var el = doc.querySelector(selector);
    return el ? (el.textContent || "").trim() : "";
  }

  function readCanonical(doc) {
    var el = doc.querySelector("link[rel='canonical']");
    return el ? (el.getAttribute("href") || "").trim() : "";
  }

  function readNewsArticleJson(doc) {
    var scripts = Array.prototype.slice.call(doc.querySelectorAll("script[type='application/ld+json']"));
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse((scripts[i].textContent || "").trim());
        var found = findNewsArticleJson(data);
        if (found) return found;
      } catch (_) {}
    }
    return null;
  }

  function findNewsArticleJson(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        var found = findNewsArticleJson(value[i]);
        if (found) return found;
      }
      return null;
    }
    if (typeof value !== "object") return null;
    if (value["@type"] === "NewsArticle" || value["@type"] === "Article") return value;
    if (value["@graph"]) return findNewsArticleJson(value["@graph"]);
    return null;
  }

  function readJsonImage(image) {
    if (!image) return "";
    if (typeof image === "string") return image;
    if (Array.isArray(image)) return readJsonImage(image[0]);
    if (typeof image === "object") return image.url || "";
    return "";
  }

  function cleanAlmalTitle(title) {
    return String(title || "").replace(/\s*-?\s*\u062c\u0631\u064a\u062f\u0629 \u0627\u0644\u0645\u0627\u0644\s*$/i, "").trim();
  }

  function normalizeAlmalDate(value) {
    return String(value || "").replace(/\s+\+(\d{2}):?(\d{2})$/, "+$1:$2");
  }

  function collectArticleText(doc) {
    var pieces = [];
    Array.prototype.slice.call(doc.querySelectorAll("article p, .article p, .news-details p, p")).slice(0, 20).forEach(function(p) {
      var text = (p.textContent || "").replace(/\s+/g, " ").trim();
      if (text && pieces.indexOf(text) === -1) pieces.push(text);
    });
    return pieces.join(" ");
  }

  function isAlreadyRendered(url) {
    if (!url) return false;
    var links = Array.prototype.slice.call(document.querySelectorAll("#resultsArea a[href]"));
    return links.some(function(link) {
      return normalizeRenderedUrl(link.href) === normalizeRenderedUrl(url);
    });
  }

  function normalizeRenderedUrl(url) {
    return String(url || "").split("?")[0].replace(/\/$/, "");
  }

  function appendDirectArticleCards(articles) {
    var area = document.getElementById("resultsArea");
    if (!area) return;

    var empty = area.querySelector(".empty-state");
    if (empty) area.innerHTML = "";

    var html = '<div class="results-header direct-source-header"><span class="results-count">' +
      '<strong>' + articles.length + '</strong> direct Al Mal source article' + (articles.length !== 1 ? "s" : "") +
      '</span></div>';

    articles.forEach(function(article) {
      html += renderDirectArticleCard(article);
    });

    area.insertAdjacentHTML("beforeend", html);
  }

  function renderDirectArticleCard(a) {
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
          '<span class="preferred-source-badge">Direct source</span>' +
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
