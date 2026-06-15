# MENA Power & Energy News

A local web app that fetches live news about power and energy in the Middle East and North Africa (MENA) region, powered by the **GNews free API** — no paid plan, no credit card.

---

## Quick setup (2 steps)

### Step 1 — Get your free GNews API key

1. Go to **https://gnews.io/register**
2. Create a free account (just email + password)
3. Copy your API key from the dashboard

The free tier has a limited daily request quota and usually returns up to 10 articles per request. This app uses one request per search by default to protect the quota.

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
- Preferred source website chips — default sources are preloaded and you can add domains like `reuters.com`, `zawya.com`, or `pv-magazine.com`
- Preferred source websites are prioritized client-side after GNews returns articles; strict website filtering is optional and controlled by a checkbox. No unsupported GNews API source parameters are used
- Arabic and English searches are both supported; the app no longer forces `lang=en`, so Arabic energy articles can be returned
- Quota-saver mode is enabled by default: one GNews API request per search
- Optional Deep recall mode can run up to 3 API requests for broader Arabic + English recall
- Show filters button — displays custom keywords, preferred source websites, and the default related energy/power keyword list used by the app, including Arabic meter/electricity terms
- Source name with favicon, publication date, summary, direct article link
- Article thumbnail images where available
- Dark mode supported automatically

---

## How to use filters

### Add custom keywords

Use the **Additional keywords** field, then press Enter, click **Add**, or click **Search news** directly. If you type a keyword and click Search without pressing Add, the app now automatically treats that typed value as an active keyword. The app will only display articles that match at least one of your custom keywords when any are added.

### How filtering is applied

Every search still uses GNews for the initial API result set, but the app also applies the visible criteria again in the browser before showing results:

1. Date range
2. Selected country / region
3. Selected sector
4. Default related energy/power keyword relevance
5. Custom keywords
6. Source websites, when **Restrict results to listed websites only** is enabled

This prevents the page from showing broad GNews results that only match the date range.

### Add preferred source websites

Use the **Preferred source websites** field, then press Enter or click **Add**. You can enter a full URL or just the domain:

```text
https://www.reuters.com/business/energy/
reuters.com
www.zawya.com
```

The app normalizes these values to clean domains such as `reuters.com` and `zawya.com`, prevents duplicates, and lets you remove them as tags. If you type a source and click Search without pressing Add, the app now automatically treats that typed value as an active source.

By default, these websites are treated as **preferred sources**. Articles from listed websites are prioritized, but other relevant energy articles are still shown. Enable **Restrict results to listed websites only** when you want strict website filtering.


### Default Arabic power/meter keywords

The default related energy keyword list includes Arabic terms for electricity meters and electricity grid searches:

```text
عداد كهرباء
عداد الكهرباء
عدادات كهرباء
عدادات الكهرباء
عدادات كهربائية
عدادات كهبرائية
عدادات مسبقة الدفع
عدادات ذكية
عداد كودي
العداد الكودي
العدادات الكودية
شبكة الكهرباء
وزارة الكهرباء
شركة توزيع الكهرباء
```

### Default preferred source websites

The app starts with these preferred source websites already listed as removable source chips:

```text
almalnews.com
attaqa.net
argaam.com
utilities-me.com
ognnews.com
mees.com
alborsaanews.com
wam.ae
amwalalghad.com
hespress.com
shafaq.com
maal.com
albayan.ae
emaratalyoum.com
alanba.com.kw
alwatan.com
thepeninsulaqatar.com
egypttoday.com
gate.ahram.org.eg
algerie-eco.com
alghad.com
```

### API request mode and quota protection

The app now has two request modes:

- **Default / quota-saver mode:** 1 GNews API request per search. This is recommended for daily use.
- **Deep recall mode:** up to 3 GNews API requests per search. Use it only when the normal search misses articles and you want wider Arabic + English recall.

This version does **not** use cached results. Every search fetches fresh data from GNews.

### Show listed filters

Click **Show filters** to display:

- Current custom keywords
- Current preferred source websites
- Whether source mode is preferred or strict
- Whether request mode is quota-saver or deep recall
- Today’s API calls tracked in this browser
- Default related energy/power keywords used to reject unrelated news

Click the close button or **Show filters** again to hide the panel.

---

## Why Arabic articles may have been missing before

The previous version forced `lang=en` in the GNews request, which excluded Arabic articles. It also used only English MENA location words for the client-side MENA filter, so Arabic Egypt/Cairo articles could be removed after fetching. This version removes the forced English language parameter, runs Arabic recall queries, adds Arabic MENA terms, and adds `almalnews.com` to the default preferred source list.

---

## Troubleshooting 429 daily limit errors

A `429` error means the GNews API key has reached its daily quota. The app cannot reset that quota from the browser. To reduce the chance of this happening:

1. Keep **Deep recall mode** unchecked for normal searches.
2. Avoid repeatedly clicking Search with different filters unless needed.
3. Wait for the API quota to reset or use another valid GNews API key.

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
