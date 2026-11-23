# Daily email digest on cPanel

`daily-digest.php` emails you the new MENA power and energy stories once a day. It reads the index that GitHub Actions already rebuilds every 6 hours (`data/news.json` on GitHub Pages), so your cPanel account only sends mail. It never scrapes Google News, which shared-hosting IPs often get blocked from.

Each email:
- groups stories by country (priority countries first), electricity before oil & gas
- folds the same story from several outlets into one item with "Also in:" links
- shows Arabic headlines right-to-left
- never repeats a story that was already emailed

## Requirements

PHP 7.4 or newer, with the cURL and mbstring extensions (both are on by default on almost every cPanel host). If you need to check, look under **Select PHP Version → Extensions**.

## Setup (about 10 minutes)

1. **Create a sending mailbox.** Go to **cPanel → Email Accounts → Create**, for example `news@yourdomain.com`. Open **Connect Devices** for that mailbox and note the *Outgoing Server* (usually `mail.yourdomain.com`, port 465, SSL).

2. **Upload the files outside `public_html`.** In **File Manager**, create `/home/USER/power-news/` (beside `public_html`, not inside it). Upload:
   - `daily-digest.php`
   - `config.sample.php`, then rename it to `config.php`

3. **Edit `config.php`.** Set `recipients`, `from_email`, the `smtp` host, username and password, and optionally `countries`, `topics` and `keywords`.

4. **Test it.** In **cPanel → Terminal** (or over SSH), run:
   ```bash
   cd ~/power-news
   php daily-digest.php --dry-run   # builds digest-preview.html, sends nothing
   php daily-digest.php --test      # sends a real email without marking stories as sent
   # also: --config=/path/config.php  --out=/path/preview.html
   ```
   If your plan has no Terminal, add a temporary cron job that runs every 5 minutes with `--test`, check your inbox, and then delete that job.

5. **Schedule it.** Go to **cPanel → Cron Jobs → Add New Cron Job**:
   - Minute `0`, Hour `10`, Day/Month/Weekday `*` for 10:00 every day (if your server's clock is Cairo time; if it is UTC, use Hour `8`)
   - Command:
     ```
     /usr/local/bin/php /home/USER/power-news/daily-digest.php >> /home/USER/power-news/digest.log 2>&1
     ```
   Replace `USER` with your cPanel username. If `/usr/local/bin/php` doesn't exist, run `which php` in Terminal and use the path it prints. Some hosts use `/opt/cpanel/ea-php82/root/usr/bin/php`.

   **Timing:** the digest is sent at **10:00 Cairo time**. The index refreshes at 00:15, 06:15, 12:15 and 18:15 UTC, so a 10:00 Cairo run (08:00 UTC) includes the morning refresh. Cron uses your server's time zone, which is shown at the top of the Cron Jobs page. Set `'lookback_hours' => 24` if you want exactly the previous 24 hours.

## Options

| Setting | What it does |
|---|---|
| `countries` | e.g. `['egypt', 'saudi arabia']`. Leave empty for all of MENA. |
| `priority_countries` | The order the countries appear in the email. |
| `topics` | `['power']` for electricity, grid, renewables and meters only. Add `'oil-gas'` to include upstream, LNG and refining. |
| `keywords` | e.g. `['meter', 'عداد', 'smart grid']` to receive only matching headlines. |
| `send_empty` | `true` sends a short "no new stories" email on quiet days. |
| `transport` | `'smtp'` (recommended) or `'mail'` (PHP `mail()`, which is more likely to land in spam). |

## Troubleshooting

- **Nothing arrives:** check `digest.log`. An SMTP error there usually means the wrong host, port or password. Try port 587 with `'encryption' => 'tls'`.
- **Lands in spam:** go to **cPanel → Email Deliverability** and repair SPF and DKIM for your domain.
- **"index was last refreshed..." warning in the email:** the GitHub Actions workflow has stopped. Open the repository's **Actions** tab and run *Update news indexes*.
- **Certificate error:** set `'verify_certificate' => false`, or use the server's own host name (shown in Connect Devices) as the SMTP host.
