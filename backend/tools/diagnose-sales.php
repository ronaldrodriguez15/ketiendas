<?php
declare(strict_types=1);

// Read-only curl probe. Credentials go through stdin; raw responses stay in memory.
require dirname(__DIR__).'/vendor/autoload.php';
$env = Dotenv\Dotenv::createArrayBacked(dirname(__DIR__))->load();
$url = rtrim($env['PHPPOS_URL'] ?? '', '/').'/sales';
$key = $env['PHPPOS_API_KEY'] ?? '';
if (!$key || !str_starts_with($url, 'https://')) { exit("Missing HTTPS POS configuration.\n"); }
function probe(string $label, array $query): array {
    global $url, $key;
    $escape = fn (string $s) => str_replace(["\\", '"', "\r", "\n"], ["\\\\", '\\"', '', ''], $s);
    $config = 'url = "'.$escape($url.'?'.http_build_query($query)).'"'."\n".
        'header = "'.$escape('x-api-key: '.$key).'"'."\n".'header = "Accept: application/json"'."\n";
    $process = proc_open(['curl.exe', '--config', '-', '--silent', '--include', '--connect-timeout', '5', '--max-time', '40', '--write-out', "\n__METRICS__%{http_code}|%{time_total}|%{size_download}"], [['pipe','r'],['pipe','w'],['pipe','w']], $pipes);
    fwrite($pipes[0], $config); fclose($pipes[0]);
    $raw = stream_get_contents($pipes[1]); fclose($pipes[1]);
    stream_get_contents($pipes[2]); fclose($pipes[2]);
    $exit = proc_close($process);
    [$response, $metrics] = array_pad(explode("\n__METRICS__", $raw), 2, '');
    $start = strpos($response, "\r\n\r\n");
    $headers = $start === false ? '' : substr($response, 0, $start);
    $body = $start === false ? '' : substr($response, $start + 4);
    $json = json_decode($body, true);
    $rows = is_array($json) && array_is_list($json) ? $json : ($json['data'] ?? []);
    if (!is_array($rows) || !array_is_list($rows)) $rows = [];
    $ids = array_column($rows, 'sale_id');
    $dates = array_values(array_filter(array_column($rows, 'sale_time'), 'is_string'));
    $parsed = array_filter(array_map(fn ($d) => DateTimeImmutable::createFromFormat('!d-m-Y h:i a', $d, new DateTimeZone('America/Bogota')) ?: null, $dates));
    $iso = array_map(fn ($d) => $d->format('c'), $parsed); $originalDates = array_values($iso); sort($iso);
    preg_match('/^x-total-records:\s*(\d+)/im', $headers, $total);
    [$status, $seconds, $bytes] = array_pad(explode('|', $metrics), 3, null);
    $states = [];
    foreach ($rows as $row) {
        $state = !empty($row['deleted']) ? 'deleted' : (isset($row['return_sale_id']) || (float)($row['total'] ?? 0) < 0 ? 'return' : (($row['suspended'] ?? '0') == '1' ? 'suspended' : ($row['mode'] ?? 'unknown')));
        $states[$state] = ($states[$state] ?? 0) + 1;
    }
    $summary = ['probe'=>$label,'exit'=>$exit,'status'=>$status,'seconds'=>$seconds,'bytes'=>$bytes,'count'=>count($rows),'x_total_records'=>$total[1] ?? null,'oldest'=>$iso[0] ?? null,'newest'=>$iso ? end($iso) : null,'id_digest'=>substr(hash('sha256',json_encode($ids)),0,12),'descending_ids'=>$ids === (function($a){rsort($a,SORT_NUMERIC);return $a;})($ids),'descending_dates'=>$originalDates===array_reverse($iso),'credit_sales'=>count(array_filter($rows,fn($r)=>in_array('Línea de crédito',array_column($r['payments']??[],'payment_type'),true))),'states'=>$states];
    echo json_encode($summary, JSON_UNESCAPED_SLASHES)."\n";
    unset($raw, $body, $json, $response, $rows);
    return ['ids'=>$ids,'dates'=>$dates,'status'=>$status];
}
if (in_array('--midnight', $argv, true)) {
    foreach (['Z','-05:00',''] as $zone) {
        probe('midnight-'.($zone ?: 'naive'), ['start_date'=>'2026-10-09T01:00:00'.$zone,'end_date'=>'2026-10-09T02:00:00'.$zone,'limit'=>100]);
    }
    exit;
}
$base = ['start_date'=>'2026-10-01T00:00:00-05:00','end_date'=>'2026-10-07T23:59:59-05:00'];
$first = probe('limit5-offset0', $base + ['limit'=>5,'offset'=>0]);
if ($first['status'] !== '200') exit(1);
$second = probe('limit5-offset5', $base + ['limit'=>5,'offset'=>5]);
echo json_encode(['probe'=>'page-comparison','overlap'=>count(array_intersect($first['ids'],$second['ids'])),'same_ids'=>$first['ids']===$second['ids']])."\n";
probe('default-1-day', ['start_date'=>'2026-10-02T00:00:00-05:00','end_date'=>'2026-10-02T23:59:59-05:00']);
probe('default-7-days', $base);
probe('default-31-days', ['start_date'=>'2026-09-09T00:00:00-05:00','end_date'=>'2026-10-09T23:59:59-05:00']);
probe('sort-asc', $base + ['limit'=>5,'offset'=>0,'sort_col'=>'sale_time','sort_dir'=>'asc']);
probe('sort-desc', $base + ['limit'=>5,'offset'=>0,'sort_col'=>'sale_time','sort_dir'=>'desc']);
foreach (['Z','-05:00',''] as $zone) {
    probe('timezone-'.($zone ?: 'naive'), ['start_date'=>'2026-10-02T00:00:00'.$zone,'end_date'=>'2026-10-02T05:00:00'.$zone,'limit'=>100]);
}
