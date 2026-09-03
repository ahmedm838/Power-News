# MENA Power & Energy News

A GitHub Pages web app for power and energy news across the Middle East and North Africa (MENA). A GitHub Actions workflow refreshes a same-origin news index every six hours, so the deployed app needs no browser API key or public CORS proxy.

---

## Quick setup

Enable GitHub Pages for the `main` branch and leave GitHub Actions enabled. The **Update news indexes** workflow runs every six hours and can also be started manually from the Actions tab.

For optional localhost development, `js/config.js` still accepts GNews or NewsAPI keys. Never commit real keys. Free provider plans generally restrict browser CORS to localhost; production live API calls require a provider-supported origin and should normally go through a backend you control.

---

## Open in Chrome

Serve the app over HTTP (not `file://`) so the browser can load the same-origin JSON index:

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

- Scheduled Google News RSS index refreshed every six hours by GitHub Actions
- Date range picker — defaults to the last 7 days, with the To date reset to today whenever the page opens or is restored by Chrome
- Filter by country/region: Egypt, Saudi Arabia, UAE, Iraq, Libya, Algeria, Morocco, and more
- Filter by energy sector: electricity, oil, gas, solar/renewables, nuclear, energy policy
- Results require concrete electricity, grid, generation, renewable, metering, or energy-industry signals before display
- Conflict-only coverage (war, missiles, attacks, military news) is rejected unless the article has a concrete power-infrastructure signal
- Custom keyword chips — add terms like `NEOM`, `power outage`, `smart meter`, or `Aramco` to refine results
- Preferred source website chips — default sources are preloaded and you can add domains like `reuters.com`, `zawya.com`, or `pv-magazine.com`
- Every default listed website gets its own scheduled Google News feed, then listed sources are prioritized client-side; strict website filtering is optional
- Arabic and English feeds are both indexed
- No API key or public CORS proxy is used by the deployed app
- Optional localhost GNews/NewsAPI support remains available for development
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
masrawy.com
youm7.com
zawya.com
almasryalyoum.com
arabic.cnn.com
alarabiya.net
powernews.cc
economyplusme.com
taqanews.com
asharqbusiness.com
algerie-eco.com
alghad.com
```

### Scheduled index and optional APIs

The deployed app searches `data/news.json` locally. GitHub Actions rebuilds that file from Arabic and English Google News RSS searches every six hours. The indexer uses precise sector phrases, excludes conflict terms from feed queries, and applies the same strict relevance test before saving an article. Broad words such as `power`, `energy`, `oil`, and `gas` do not qualify an article by themselves. The existing Al Mal index is refreshed in the same workflow.

When optional localhost API keys are configured, the app merges those provider results with the scheduled index. A provider failure no longer discards results from the other sources.

### Show listed filters

Click **Show filters** to display:

- Current custom keywords
- Current preferred source websites
- Whether source mode is preferred or strict
- Whether the scheduled index or optional API recall is active
- Today’s API calls tracked in this browser
- Default related energy/power keywords used to reject unrelated news

Click the close button or **Show filters** again to hide the panel.

---

## Why Arabic articles may have been missing before

The previous version forced `lang=en` in the GNews request, which excluded Arabic articles. It also used only English MENA location words for the client-side MENA filter, so Arabic Egypt/Cairo articles could be removed after fetching. This version removes the forced English language parameter, runs Arabic recall queries, adds Arabic MENA terms, and adds `almalnews.com` to the default preferred source list.

---

## Troubleshooting

- If the index is stale, run **Update news indexes** from the repository Actions tab.
- If Search reports an index HTTP error, confirm that `data/news.json` exists on the deployed branch and that GitHub Pages has finished deploying the latest commit.
- `401`, `403`, and `429` errors can only come from optional localhost API providers; remove the optional key to keep using the scheduled index alone.

---

## File structure

```text
mena-power-news/
├── index.html
├── data/
│   └── news.json
├── css/
│   └── style.css
├── js/
│   ├── config.js   ← optional localhost keys only; never commit real keys
│   └── app.js
├── scripts/
│   └── build-news-index.mjs
└── README.md
```
