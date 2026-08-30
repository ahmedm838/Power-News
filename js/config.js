// ─────────────────────────────────────────────────────────────────────────────
//  MENA Power & Energy News — optional local-development configuration
//
//  The deployed GitHub Pages app reads data/news.json, which is refreshed by
//  GitHub Actions. Do not commit API keys to this public repository.
//
//  Optional live API calls are supported only for localhost development (or a
//  provider plan that explicitly enables CORS for your production origin).
// ─────────────────────────────────────────────────────────────────────────────

// Optional extra provider for broader recall:
// 1. Go to https://newsapi.org/register
// 2. Copy your NewsAPI key
// 3. Replace YOUR_NEWSAPI_API_KEY_HERE below
// NewsAPI Developer keys are also intended for localhost/development use.
const CONFIG = {
  GNEWS_API_KEY: "YOUR_GNEWS_API_KEY_HERE",
  NEWSAPI_API_KEY: "YOUR_NEWSAPI_API_KEY_HERE",
};
