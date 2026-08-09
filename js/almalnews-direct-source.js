// Direct Al Mal News fallback.
// Some Arabic Al Mal articles are not indexed by GNews/NewsAPI, even when
// almalnews.com is in the source list. This fetches Al Mal's own tag pages,
// extracts article URLs, then reads article metadata directly.
(function() {
  if (typeof runSearch !== "function" || typeof fetchWithProxy !== "function") return;

  var originalRunSearch = runSearch;
  var ALMAL_DOMAIN = "almalnews.com";
  var ALMAL_BASE = "https://almalnews.com";
  var ALMAL_MAX_LIST_PAGES = 3;
  var ALMAL_MAX_ARTICLES_TO_READ = 18;

  var ALMAL_TAGS = [
    "وزارة-الكهرباء",
    "الكهرباء",
    "طاقة",
    "وزير-الكهرباء",
    "الشبكة-القومية-للكهرباء",
    "القابضة-للكهرباء",
    "القابضة-لكهرباء-مصر",
    "عدادات-الكهرباء",
    "الطاقة-المتجددة"
  ];

  runSearch = async function() {
    await originalRunSearch();
    await appendAlmalDirectResults();
  };

  function isAlmalEnabled() {
    return Array.isArray(sourceWebsites) && sourceWebsites.indexOf(ALMAL_DOMAIN) !== -1;
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
      var directArticles = await fetchAlmalDirectArticles(dateFrom, dateTo, region);
      var filtered = directArticles
        .filter(function(article) { return !isAlreadyRendered(article.url); })
        .filter(function(article) { return matchesDateRange(article, dateFrom, dateTo); })
        .filter(isMenaArticle)
        .filter(function(article) { return matchesRelatedEnergyKeywords(article, keywords); })
        .filter(function(article) { return matchesKeywords(article, keywords); });

      if (!filtered.length) return;

      filtered = sortMergedArticles(filtered, sortBy);
      appendDirectArticleCards(filtered);
    } catch (err) {
      console.warn("Al Mal direct source failed:", err.message);
    }
  }

  async function fetchAlmalDirectArticles(dateFrom, dateTo, region) {
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
          var html = await fetchTextThroughProxy(listUrl);
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

  async function fetchAlmalArticleMetadata(url) {
    var html = await fetchTextThroughProxy(url);
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
      content: collectArticleText(doc),
      url: canonical,
      image: image || "",
      publishedAt: normalizeAlmalDate(publishedAt),
      source: {
        name: "جريدة المال",
        url: ALMAL_BASE
      },
      provider: "Al Mal direct"
    };
  }

  async function fetchTextThroughProxy(url) {
    var res = await fetchWithProxy(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
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
    return String(title || "").replace(/\s*-?\s*جريدة المال\s*$/i, "").trim();
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

