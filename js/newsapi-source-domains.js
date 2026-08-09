// NewsAPI supports a domains parameter, so use the source chips as a real
// provider-side recall signal. GNews does not support domain scoping in its
// search endpoint, so this patch only changes NewsAPI requests.
(function() {
  if (typeof buildNewsApiTasks !== "function" || typeof buildNewsApiUrl !== "function") return;

  var SOURCE_DOMAIN_PREFIX = "__source_domains__::";
  var originalBuildNewsApiTasks = buildNewsApiTasks;
  var originalBuildNewsApiUrl = buildNewsApiUrl;

  function getNewsApiSourceDomains() {
    if (!Array.isArray(sourceWebsites)) return "";

    var seen = {};
    var domains = [];

    sourceWebsites.forEach(function(domain) {
      var clean = normalizeDomain(domain);
      if (!clean || seen[clean]) return;
      seen[clean] = true;
      domains.push(clean);
    });

    return domains.join(",");
  }

  function withSourceDomains(query) {
    return SOURCE_DOMAIN_PREFIX + query;
  }

  function isSourceDomainQuery(query) {
    return String(query || "").indexOf(SOURCE_DOMAIN_PREFIX) === 0;
  }

  function withoutSourceDomainPrefix(query) {
    return String(query || "").replace(SOURCE_DOMAIN_PREFIX, "");
  }

  buildNewsApiTasks = function(queries, dateWindows, deepRecall) {
    var domains = getNewsApiSourceDomains();
    if (!domains) return originalBuildNewsApiTasks(queries, dateWindows, deepRecall);

    var strictSourceFilter = isStrictSourceMode();
    var baseWindowCalls = Math.max(1, dateWindows.length);
    var budget = Math.min(
      deepRecall ? NEWSAPI_DEEP_RECALL_MAX_CALLS : NEWSAPI_DEFAULT_MAX_CALLS,
      baseWindowCalls + dateWindows.length + (deepRecall ? 2 : 0)
    );
    var tasks = [];
    var w;
    var q;

    // First spend NewsAPI calls where it can help most: search inside the listed domains.
    for (w = 0; w < dateWindows.length && tasks.length < budget; w++) {
      tasks.push({
        query: withSourceDomains(queries[0]),
        from: dateWindows[w].from,
        to: dateWindows[w].to,
        page: 1
      });
    }

    if (deepRecall) {
      for (q = 1; q < queries.length && tasks.length < budget; q++) {
        for (w = 0; w < dateWindows.length && tasks.length < budget; w++) {
          tasks.push({
            query: withSourceDomains(queries[q]),
            from: dateWindows[w].from,
            to: dateWindows[w].to,
            page: 1
          });
        }
      }
    }

    // In strict mode, every NewsAPI request must stay inside the listed domains.
    if (strictSourceFilter) return tasks;

    // In preferred mode, keep some broad NewsAPI coverage when the call budget allows it.
    var broadTasks = originalBuildNewsApiTasks(queries, dateWindows, deepRecall);
    for (var i = 0; i < broadTasks.length && tasks.length < budget; i++) {
      tasks.push(broadTasks[i]);
    }

    return tasks;
  };

  buildNewsApiUrl = function(query, dateFrom, dateTo, sortBy, page) {
    var useSourceDomains = isSourceDomainQuery(query);
    var cleanQuery = useSourceDomains ? withoutSourceDomainPrefix(query) : query;
    var url = originalBuildNewsApiUrl(cleanQuery, dateFrom, dateTo, sortBy, page);

    if (useSourceDomains) {
      var domains = getNewsApiSourceDomains();
      if (domains) url += "&domains=" + encodeURIComponent(domains);
    }

    return url;
  };
})();
