<?php
// ─────────────────────────────────────────────────────────────────────────────
//  MENA Power News — daily email digest for cPanel
//
//  Reads the news index published by GitHub Pages (data/news.json), picks the
//  stories published since the last run that weren't emailed before, groups
//  them by country, and emails an HTML digest.
//
//  Usage (cPanel → Cron Jobs):
//    php /home/USER/power-news/daily-digest.php
//  Options:
//    --dry-run   build the email, save digest-preview.html, send nothing
//    --test      send even if the stories were already emailed (does not mark them sent)
// ─────────────────────────────────────────────────────────────────────────────

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Run this script from cron / the command line.\n");
}

$args   = array_slice($argv, 1);
$dryRun = in_array('--dry-run', $args, true);
$test   = in_array('--test', $args, true);

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "Missing config.php — copy config.sample.php to config.php and edit it.\n");
    exit(1);
}
$cfg = require $configFile;
date_default_timezone_set($cfg['timezone'] ?? 'Africa/Cairo');

if (!function_exists('str_ends_with')) { // PHP 7.x hosts
    function str_ends_with(string $h, string $n): bool { return $n === '' || substr($h, -strlen($n)) === $n; }
}
if (!function_exists('mb_strtolower')) {
    fwrite(STDERR, "The PHP mbstring extension is required (cPanel → Select PHP Version → Extensions).\n");
    exit(1);
}

const COUNTRY_LABELS = [
    'egypt' => ['Egypt', 'مصر'], 'saudi arabia' => ['Saudi Arabia', 'السعودية'], 'UAE' => ['UAE', 'الإمارات'],
    'iraq' => ['Iraq', 'العراق'], 'iran' => ['Iran', 'إيران'], 'libya' => ['Libya', 'ليبيا'],
    'algeria' => ['Algeria', 'الجزائر'], 'morocco' => ['Morocco', 'المغرب'], 'tunisia' => ['Tunisia', 'تونس'],
    'jordan' => ['Jordan', 'الأردن'], 'kuwait' => ['Kuwait', 'الكويت'], 'qatar' => ['Qatar', 'قطر'],
    'oman' => ['Oman', 'عُمان'], 'bahrain' => ['Bahrain', 'البحرين'], 'lebanon' => ['Lebanon', 'لبنان'],
    'syria' => ['Syria', 'سوريا'], 'palestine' => ['Palestine', 'فلسطين'], 'israel' => ['Israel', 'إسرائيل'],
    'yemen' => ['Yemen', 'اليمن'], 'sudan' => ['Sudan', 'السودان'], 'mauritania' => ['Mauritania', 'موريتانيا'],
    'turkey' => ['Turkey', 'تركيا'], 'mena' => ['Region-wide', 'إقليمي'],
];

// ── 1. Download the index ───────────────────────────────────────────────────
function http_get(string $url): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_USERAGENT      => 'Power-News-Digest/1.0',
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($body === false || $code >= 400) throw new RuntimeException("Download failed ($code) $err");
        return $body;
    }
    $body = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 60]]));
    if ($body === false) throw new RuntimeException('Download failed (enable cURL or allow_url_fopen)');
    return $body;
}

// Cache-buster so we never get a stale CDN copy.
$sep  = strpos($cfg['feed_url'], '?') === false ? '?' : '&';
$data = json_decode(http_get($cfg['feed_url'] . $sep . 't=' . time()), true);
if (!is_array($data) || !isset($data['articles'])) {
    fwrite(STDERR, "The news index is not valid JSON.\n");
    exit(1);
}

// ── 2. Pick new stories ─────────────────────────────────────────────────────
$stateFile = $cfg['state_file'] ?? (__DIR__ . '/sent-articles.json');
$sent      = is_file($stateFile) ? (json_decode((string) file_get_contents($stateFile), true) ?: []) : [];
$since     = time() - 3600 * (int) ($cfg['lookback_hours'] ?? 26);
$countries = $cfg['countries'] ?? [];
$topics    = $cfg['topics'] ?? ['power', 'oil-gas'];
$keywords  = array_map('mb_strtolower', $cfg['keywords'] ?? []);

function article_key(array $a): string
{
    return sha1(mb_strtolower(trim(clean_title($a))));
}

function clean_title(array $a): string
{
    $title = (string) ($a['title'] ?? '');
    $name  = (string) ($a['source']['name'] ?? '');
    if ($name !== '' && str_ends_with($title, ' - ' . $name)) {
        $title = mb_substr($title, 0, mb_strlen($title) - mb_strlen($name) - 3);
    }
    return trim($title);
}

$picked = [];
foreach ($data['articles'] as $a) {
    $ts = strtotime($a['publishedAt'] ?? '');
    if (!$ts || $ts < $since) continue;
    if (!$test && isset($sent[article_key($a)])) continue;

    $topic = $a['topic'] ?? 'power';
    if ($topics && !in_array($topic, $topics, true)) continue;

    $regions = $a['regions'] ?? [];
    if (!$regions) $regions = ['mena'];
    if ($countries && !array_intersect($regions, $countries)) continue;

    if ($keywords) {
        $hay = mb_strtolower(($a['title'] ?? '') . ' ' . ($a['description'] ?? ''));
        $hit = false;
        foreach ($keywords as $k) if ($k !== '' && mb_strpos($hay, $k) !== false) { $hit = true; break; }
        if (!$hit) continue;
    }
    $a['_ts'] = $ts;
    $a['_regions'] = $regions;
    $picked[] = $a;
}

usort($picked, fn($x, $y) => $y['_ts'] <=> $x['_ts']);
$picked = array_slice($picked, 0, (int) ($cfg['max_items'] ?? 120));

if (!$picked && empty($cfg['send_empty']) && !$dryRun) {
    echo date('c') . " — no new stories, nothing sent.\n";
    exit(0);
}

// ── 3. Group by country (each story under its first country) ─────────────────
$groups = [];
foreach ($picked as $a) {
    $primary = $a['_regions'][0];
    if ($countries) {
        foreach ($a['_regions'] as $r) if (in_array($r, $countries, true)) { $primary = $r; break; }
    }
    $groups[$primary][] = $a;
}
$priority = $cfg['priority_countries'] ?? [];
uksort($groups, function ($x, $y) use ($groups, $priority) {
    $px = array_search($x, $priority, true); $py = array_search($y, $priority, true);
    if ($px !== false || $py !== false) {
        if ($px === false) return 1;
        if ($py === false) return -1;
        return $px <=> $py;
    }
    if ($x === 'mena') return 1;
    if ($y === 'mena') return -1;
    return count($groups[$y]) <=> count($groups[$x]);
});
foreach ($groups as &$list) {
    // electricity first, then oil & gas; newest first inside each
    usort($list, fn($x, $y) => [($x['topic'] ?? 'power') !== 'power', -$x['_ts']] <=> [($y['topic'] ?? 'power') !== 'power', -$y['_ts']]);
}
unset($list);

// ── 3b. Fold near-duplicate headlines (same story, different outlets) ────────
function title_tokens(string $title): array
{
    $t = mb_strtolower($title);
    $t = strtr($t, ['أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ى' => 'ي', 'ة' => 'ه', 'ـ' => '']);
    $t = preg_replace('/[\x{064B}-\x{065F}]/u', '', $t);
    $t = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $t);
    $out = [];
    foreach (explode(' ', $t) as $w) {
        // light Arabic prefix stripping: و ف ب ل ال لل
        $w = preg_replace('/^(?:[وفب]?(?:ال|لل)|[وفبل])(?=\p{L}{3,})/u', '', $w);
        if (mb_strlen($w) >= 3) $out[$w] = true;
    }
    return $out;
}

function similar_titles(array $a, array $b): bool
{
    if (!$a || !$b) return false;
    $shared = count(array_intersect_key($a, $b));
    return $shared >= 3 && $shared / min(count($a), count($b)) >= 0.5;
}

foreach ($groups as &$list) {
    $clusters = [];
    foreach ($list as $a) {
        $tok = title_tokens(clean_title($a));
        foreach ($clusters as &$c) {
            if (abs($c['lead']['_ts'] - $a['_ts']) < 48 * 3600 && similar_titles($c['tokens'], $tok)) {
                $c['also'][] = $a;
                continue 2;
            }
        }
        unset($c);
        $a['_also'] = [];
        $clusters[] = ['lead' => $a, 'tokens' => $tok, 'also' => []];
    }
    $list = array_map(function ($c) { $c['lead']['_also'] = $c['also']; return $c['lead']; }, $clusters);
}
unset($list);

// ── 4. Build the email ──────────────────────────────────────────────────────
$h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$count   = array_sum(array_map('count', $groups)); // distinct stories after folding
$today   = date('l j F Y');
$subject = strtr($cfg['subject'] ?? 'MENA Power News — {date} ({count} stories)', [
    '{date}' => date('j M Y'), '{count}' => (string) $count,
]);

$generated = strtotime($data['generatedAt'] ?? '') ?: 0;
$staleNote = '';
if ($generated && time() - $generated > 18 * 3600) {
    $staleNote = 'Note: the news index was last refreshed ' . date('j M H:i', $generated)
        . '. Check the "Update news indexes" workflow on GitHub.';
}

$summary = [];
foreach ($groups as $key => $list) $summary[] = (COUNTRY_LABELS[$key][0] ?? $key) . ' ' . count($list);

$html  = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>';
$html .= '<body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#111827">';
$html .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">';
$html .= '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">';
$html .= '<tr><td style="background:#0f3d5e;color:#ffffff;padding:22px 24px">'
      .  '<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8">Daily digest</div>'
      .  '<div style="font-size:22px;font-weight:700;margin-top:4px">MENA Power &amp; Energy News</div>'
      .  '<div style="font-size:13px;margin-top:6px;opacity:.9">' . $h($today) . ' · ' . $count . ' new stories</div></td></tr>';
if ($summary) {
    $html .= '<tr><td style="padding:14px 24px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb">' . $h(implode('  ·  ', $summary)) . '</td></tr>';
}
if ($staleNote) {
    $html .= '<tr><td style="padding:10px 24px;background:#fef3c7;font-size:13px;color:#92400e">' . $h($staleNote) . '</td></tr>';
}
if (!$picked) {
    $html .= '<tr><td style="padding:24px;font-size:15px">No new MENA power stories since the last digest.</td></tr>';
}

$text = "MENA Power & Energy News — $today\n$count new stories\n\n";

foreach ($groups as $key => $list) {
    [$en, $ar] = COUNTRY_LABELS[$key] ?? [$key, ''];
    $html .= '<tr><td style="padding:20px 24px 6px"><div style="font-size:16px;font-weight:700;color:#0f3d5e;border-bottom:2px solid #0f3d5e;padding-bottom:6px">'
          .  $h($en) . ($ar ? ' <span style="font-weight:400;color:#6b7280">· ' . $h($ar) . '</span>' : '')
          .  ' <span style="font-weight:400;color:#6b7280;font-size:13px">(' . count($list) . ')</span></div></td></tr>';
    $text .= strtoupper($en) . "\n";

    foreach ($list as $a) {
        $title  = clean_title($a);
        $source = $a['source']['name'] ?? '';
        $when   = date('D j M, H:i', $a['_ts']);
        $isPower = ($a['topic'] ?? 'power') === 'power';
        $badge  = $isPower
            ? '<span style="background:#dbeafe;color:#1e40af;border-radius:4px;padding:1px 6px;font-size:11px">Power</span>'
            : '<span style="background:#fde68a;color:#92400e;border-radius:4px;padding:1px 6px;font-size:11px">Oil &amp; gas</span>';
        $rtl = preg_match('/\p{Arabic}/u', $title) ? 'rtl' : 'ltr';
        $align = $rtl === 'rtl' ? 'right' : 'left';
        $also = '';
        $alsoText = '';
        if (!empty($a['_also'])) {
            $links = [];
            foreach ($a['_also'] as $o) {
                $links[] = '<a href="' . $h($o['url']) . '" style="color:#0f3d5e">' . $h($o['source']['name'] ?? 'link') . '</a>';
                $alsoText .= "  also: " . ($o['source']['name'] ?? '') . " {$o['url']}\n";
            }
            $also = '<div dir="' . $rtl . '" style="text-align:' . $align . ';font-size:12px;color:#6b7280;margin-top:3px">'
                  . ($rtl === 'rtl' ? 'تغطية أخرى: ' : 'Also in: ') . implode(' · ', $links) . '</div>';
        }
        $html .= '<tr><td style="padding:10px 24px;border-bottom:1px solid #f3f4f6">'
              .  '<div dir="' . $rtl . '" style="text-align:' . $align . ';font-size:15px;line-height:1.5">'
              .  '<a href="' . $h($a['url']) . '" style="color:#111827;text-decoration:none;font-weight:600">' . $h($title) . '</a></div>'
              .  '<div dir="' . $rtl . '" style="text-align:' . $align . ';font-size:12px;color:#6b7280;margin-top:4px">' . $badge . '&nbsp; ' . $h($source) . ' · <span dir="ltr">' . $h($when) . '</span></div>'
              .  $also
              .  '</td></tr>';
        $text .= "- $title\n  $source · $when\n  {$a['url']}\n$alsoText";
    }
    $text .= "\n";
}

$site = $cfg['site_url'] ?? '';
$html .= '<tr><td style="padding:18px 24px;font-size:12px;color:#6b7280;background:#f9fafb">'
      .  ($site ? 'Search and filter all stories at <a href="' . $h($site) . '" style="color:#0f3d5e">' . $h($site) . '</a>.<br>' : '')
      .  'Sent automatically by your cPanel cron job.</td></tr>';
$html .= '</table></td></tr></table></body></html>';
if ($site) $text .= "Search all stories: $site\n";

if ($dryRun) {
    file_put_contents(__DIR__ . '/digest-preview.html', $html);
    echo "Dry run: $count stories. Preview written to " . __DIR__ . "/digest-preview.html\nSubject: $subject\n";
    exit(0);
}

// ── 5. Send ─────────────────────────────────────────────────────────────────
function encode_header(string $s): string
{
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

function build_message(array $cfg, string $to, string $subject, string $html, string $text): array
{
    $boundary = 'b' . bin2hex(random_bytes(12));
    $domain   = substr(strrchr($cfg['from_email'], '@'), 1) ?: 'localhost';
    $headers = [
        'Date: ' . date('r'),
        'From: ' . encode_header($cfg['from_name'] ?? 'Power News') . ' <' . $cfg['from_email'] . '>',
        'To: <' . $to . '>',
        'Subject: ' . encode_header($subject),
        'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];
    $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($text))
          . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($html))
          . "--$boundary--\r\n";
    return [$headers, $body];
}

function smtp_read($fp): string
{
    $data = '';
    while (($line = fgets($fp, 1024)) !== false) {
        $data .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') break;
    }
    return $data;
}

function smtp_cmd($fp, ?string $cmd, array $ok): string
{
    if ($cmd !== null) fwrite($fp, $cmd . "\r\n");
    $resp = smtp_read($fp);
    $code = (int) substr($resp, 0, 3);
    if (!in_array($code, $ok, true)) {
        $shown = $cmd !== null && stripos($cmd, 'AUTH') !== 0 && strlen($cmd) < 80 ? $cmd : '(auth/data)';
        throw new RuntimeException("SMTP error after $shown: " . trim($resp));
    }
    return $resp;
}

function smtp_send(array $smtp, string $from, string $to, array $headers, string $body): void
{
    $secure = strtolower($smtp['encryption'] ?? 'ssl');
    $verify = $smtp['verify_certificate'] ?? true;
    $ctx = stream_context_create(['ssl' => [
        'verify_peer' => $verify, 'verify_peer_name' => $verify, 'allow_self_signed' => !$verify,
    ]]);
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $smtp['host'] . ':' . (int) $smtp['port'];
    $fp = @stream_socket_client($remote, $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("Cannot connect to $remote: $errstr");
    stream_set_timeout($fp, 30);

    $helo = gethostname() ?: 'localhost';
    smtp_cmd($fp, null, [220]);
    smtp_cmd($fp, "EHLO $helo", [250]);
    if ($secure === 'tls') {
        smtp_cmd($fp, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('STARTTLS negotiation failed');
        }
        smtp_cmd($fp, "EHLO $helo", [250]);
    }
    if (!empty($smtp['username'])) {
        smtp_cmd($fp, 'AUTH LOGIN', [334]);
        smtp_cmd($fp, base64_encode($smtp['username']), [334]);
        smtp_cmd($fp, base64_encode($smtp['password']), [235]);
    }
    smtp_cmd($fp, "MAIL FROM:<$from>", [250]);
    smtp_cmd($fp, "RCPT TO:<$to>", [250, 251]);
    smtp_cmd($fp, 'DATA', [354]);
    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    $message = preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $message));
    fwrite($fp, $message . "\r\n.\r\n");
    smtp_cmd($fp, null, [250]);
    smtp_cmd($fp, 'QUIT', [221]);
    fclose($fp);
}

$failures = 0;
foreach ($cfg['recipients'] as $to) {
    [$headers, $body] = build_message($cfg, $to, $subject, $html, $text);
    try {
        if (($cfg['transport'] ?? 'smtp') === 'mail') {
            $extra = array_values(array_filter($headers, fn($l) => stripos($l, 'To:') !== 0 && stripos($l, 'Subject:') !== 0));
            if (!mail($to, encode_header($subject), $body, implode("\r\n", $extra), '-f' . $cfg['from_email'])) {
                throw new RuntimeException('PHP mail() returned false');
            }
        } else {
            smtp_send($cfg['smtp'], $cfg['from_email'], $to, $headers, $body);
        }
        echo date('c') . " — sent $count stories to $to\n";
    } catch (Throwable $e) {
        $failures++;
        fwrite(STDERR, date('c') . " — FAILED for $to: " . $e->getMessage() . "\n");
    }
}

// ── 6. Remember what was sent (only if at least one copy went out) ───────────
if (!$test && $failures < count($cfg['recipients'])) {
    $now = time();
    foreach ($picked as $a) $sent[article_key($a)] = $now;
    $sent = array_filter($sent, fn($t) => $t > $now - 21 * 86400); // keep 3 weeks
    file_put_contents($stateFile, json_encode($sent), LOCK_EX);
}

exit($failures ? 1 : 0);
