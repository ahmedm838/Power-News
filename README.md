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

> Important for public GitHub repositories: a browser-only GitHub Pages app cannot fully hide an API key. For internal use, keep the repository private or protect the key by using your own backend/proxy.

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
- Results are narrowed to related energy and power keywords before display
- Custom keyword chips — add terms like `NEOM`, `power outage`, `smart meter`, or `Aramco` to refine results
- Preferred source website chips — add domains like `reuters.com`, `zawya.com`, or `pv-magazine.com`
- Source website filtering is done client-side after GNews returns articles; no unsupported GNews API source parameters are used
- Show filters button — displays custom keywords, preferred source websites, and the default related energy/power keyword list used by the app
- Source name with favicon, publication date, summary, direct article link
- Article thumbnail images where available
- Dark mode supported automatically

---

## How to use filters

### Add custom keywords

Use the **Additional keywords** field, then press Enter or click **Add**. The app will only display articles that match at least one of your custom keywords when any are added.

### Add preferred source websites

Use the **Preferred source websites** field, then press Enter or click **Add**. You can enter a full URL or just the domain:

```text
https://www.reuters.com/business/energy/
reuters.com
www.zawya.com
```

The app normalizes these values to clean domains such as `reuters.com` and `zawya.com`, prevents duplicates, and lets you remove them as tags.

### Show listed filters

Click **Show filters** to display:

- Current custom keywords
- Current preferred source websites
- Default related energy/power keywords used to reject unrelated news

Click the close button or **Show filters** again to hide the panel.

---

## File structure

```text
mena-power-news/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js   ← paste your GNews API key here
│   └── app.js
└── README.md
```
