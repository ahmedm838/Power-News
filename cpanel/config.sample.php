<?php
// ─────────────────────────────────────────────────────────────────────────────
//  Power News daily digest — configuration
//  Copy this file to config.php (same folder) and fill in your details.
//  config.php holds your mailbox password: keep it OUTSIDE public_html.
// ─────────────────────────────────────────────────────────────────────────────
return [
    // The index the GitHub Actions workflow refreshes every 6 hours.
    'feed_url' => 'https://ahmedm838.github.io/Power-News/data/news.json',

    // Who receives the digest. Each recipient gets their own copy.
    'recipients' => [
        'you@example.com',
    ],

    // Sender. Use a mailbox that exists on your cPanel domain
    // (cPanel → Email Accounts), e.g. news@yourdomain.com.
    'from_email' => 'news@yourdomain.com',
    'from_name'  => 'MENA Power News',
    'subject'    => 'MENA Power News — {date} ({count} stories)',

    // Link shown at the top/bottom of the email.
    'site_url' => 'https://ahmedm838.github.io/Power-News/',

    // ── What to include ────────────────────────────────────────────────────
    // Hours to look back. Slightly over 24 so nothing falls between runs;
    // already-sent stories are never repeated.
    'lookback_hours' => 26,

    // Country keys to include; empty = all of MENA. Available keys:
    // egypt, saudi arabia, UAE, iraq, iran, libya, algeria, morocco, tunisia,
    // jordan, kuwait, qatar, oman, bahrain, lebanon, syria, palestine, israel,
    // yemen, sudan, mauritania, turkey, mena (region-wide stories)
    'countries' => [],

    // Countries listed here appear first in the email, in this order.
    'priority_countries' => ['egypt', 'saudi arabia', 'UAE'],

    // 'power' = electricity, grid, renewables, meters; 'oil-gas' = upstream/LNG/refining.
    'topics' => ['power', 'oil-gas'],

    // Optional: only include stories whose title contains one of these words
    // (Arabic or English), e.g. ['meter', 'عداد', 'smart grid']. Empty = no filter.
    'keywords' => [],

    'max_items'  => 60,    // Gmail clips emails over ~100 KB; 60 stories stays under it
    'send_empty' => false,   // true = send a short "no new stories" email on quiet days
    'timezone'   => 'Africa/Cairo',

    // ── How to send ────────────────────────────────────────────────────────
    // 'smtp' (recommended: authenticated, better inbox delivery) or 'mail' (PHP mail()).
    'transport' => 'smtp',
    'smtp' => [
        'host'       => 'mail.yourdomain.com', // cPanel → Email Accounts → Connect Devices
        'port'       => 465,
        'encryption' => 'ssl',                 // 'ssl' for 465, 'tls' for 587
        'username'   => 'news@yourdomain.com',
        'password'   => 'CHANGE_ME',
        'verify_certificate' => true,          // set false only if your host's mail cert doesn't match the host name
    ],

    // Remembers which stories were already emailed (created automatically).
    'state_file' => __DIR__ . '/sent-articles.json',
];
