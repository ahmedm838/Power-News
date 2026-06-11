# MENA Power & Energy News

A local web app that fetches live news about power and energy in the Middle East and North Africa (MENA) region, powered by the **GNews free API** — no paid plan, no credit card.

---

## Quick setup (2 steps)

### Step 1 — Get your free GNews API key

1. Go to **https://gnews.io/register**
2. Create a free account (just email + password)
3. Copy your API key from the dashboard

Free tier gives you **100 requests/day** and 10 articles per request.

### Step 2 — Paste the key into config.js

Open `js/config.js` and replace `YOUR_GNEWS_API_KEY_HERE` with your key:

```js
const CONFIG = {
  GNEWS_API_KEY: "abc123yourrealkeyhere",
};
```

Save the file.

---

## Open in Chrome

Because the app calls the GNews API directly from the browser, you need to serve it over HTTP (not `file://`). Run one of these from the project folder:

**Python** (usually pre-installed on Mac/Linux):
```bash
python3 -m http.server 8080
```
Then open **http://localhost:8080** in Chrome.

**Node.js:**
```bash
npx serve .
```
Then open the URL shown in the terminal.

> **Windows users without Python/Node:** Install Python from https://python.org (it's free), then run the command above in a terminal opened in the project folder.

---

## Features

- Live news via GNews.io (real articles, real sources, real links)
- Date range picker — defaults to the last 7 days
- Filter by country/region: Egypt, Saudi Arabia, UAE, Iraq, Libya, Algeria, Morocco, and more
- Filter by energy sector: electricity, oil, gas, solar/renewables, nuclear, energy policy
- Sort newest → oldest or by relevance
- Custom keyword chips — add terms like "NEOM", "power outage", "Aramco" to refine results
- Article thumbnail images where available
- Source name with favicon, publication date, summary, direct article link
- Dark mode supported automatically

---

## File structure

```
mena-power-news/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js   ← paste your GNews API key here
│   └── app.js
└── README.md
```
