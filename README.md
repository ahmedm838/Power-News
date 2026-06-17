# MENA Power & Energy News

A local web app that fetches live news about power and energy in the Middle East and North Africa (MENA) region, powered by the **GNews free API** — no paid plan, no credit card.

---

## Quick setup (2 steps)

### Step 1 — Get your free GNews API key

1. Go to **https://gnews.io/register**
2. Create a free account (just email + password)
3. Copy your API key from the dashboard

The free tier has a limited daily request quota and usually returns up to 10 articles per request. To make date ranges meaningful, this app uses 1–4 non-overlapping date-window requests in normal mode, depending on the selected range.

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
- Quota-saver mode is enabled by default: 1–4 API requests are used to cover non-overlapping parts of the selected date range
- Optional Deep recall mode adds Arabic + English query variants and is capped at 6 API requests
- No browser result cache is used; each search requests fresh data
- Show filters button — displays custom keywords, preferred source websites, and the default related energy/power keyword list used by the app, including Arabic meter/electricity terms
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

- **Default / quota-saver mode:** the selected range is divided into 1 window for up to 7 days, 2 windows for 8–30 days, 3 windows for 31–90 days, and 4 windows for longer ranges. Each window uses one request and returns its own first page, preventing older parts of the range from being hidden behind the newest 10 results.
- **Deep recall mode:** uses the same date-window coverage and adds alternate Arabic/English queries, with a maximum of 6 API requests per search.

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

## Troubleshooting API limit errors

- A `403` response normally means the daily request quota has been reached.
- A `429` response means requests were sent too quickly. The app spaces multi-window calls by 1.1 seconds to stay within the free-plan rate limit.

To reduce API usage:

1. Keep **Deep recall mode** unchecked for normal searches.
2. Use a shorter date range when broad historical coverage is not required.
3. Avoid repeatedly clicking Search with different filters unless needed.
4. Wait for the daily quota reset or use another valid GNews API key after a `403` response.

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
