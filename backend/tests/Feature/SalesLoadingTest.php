<?php
declare(strict_types=1);
namespace Tests\Feature;

use App\Models\User;
use App\Services\Sales\SaleMapper;
use Carbon\CarbonImmutable;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\TransferStats;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class SalesLoadingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.url' => 'https://pos.test', 'phppos.key' => 'secret-test-key', 'phppos.cache_store' => 'array']);
        Cache::store('array')->flush();
        Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-16 12:00', 'America/Bogota'));
        Sanctum::actingAs(new User());
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function sale(int $id, string $date = '2026-10-16', array $extra = []): array
    {
        return array_replace(['sale_id' => $id, 'sale_time' => CarbonImmutable::parse($date)->format('d-m-Y').' 11:00 pm',
            'total' => '100', 'payments' => [['payment_type' => 'Efectivo', 'payment_amount' => 100]], 'customer_id' => 7], $extra);
    }

    public function test_first_page_only_loads_newest_day_and_overlap_reuses_cache(): void
    {
        Http::fake(['*' => Http::response(array_map(fn ($id) => $this->sale($id), range(1, 35)))]);
        $this->getJson('/api/ventas')->assertOk()->assertJsonCount(10, 'data')
            ->assertJsonPath('page', 1)->assertJsonPath('total', null)->assertJsonPath('has_more', true)
            ->assertJsonPath('desde', '2026-10-10')->assertJsonPath('hasta', '2026-10-16')
            ->assertJsonPath('meta.total_cobrado', null)->assertJsonPath('meta.cobrado_pagina', 1000)
            ->assertJsonPath('data.0.id', 35)->assertJsonPath('data.9.id', 26);
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r->method() === 'GET' && $r['start_date'] === '2026-10-16T05:00:00Z'
            && $r['end_date'] === '2026-10-17T04:59:59Z' && !isset($r['limit']) && !isset($r['offset']));
        $this->getJson('/api/ventas?page=2')->assertOk()->assertJsonPath('data.0.id', 25)->assertJsonPath('has_more', true);
        $this->getJson('/api/ventas?desde=2026-10-01&hasta=2026-10-16')->assertOk()->assertJsonPath('total', null);
        Http::assertSentCount(1);
        $this->assertCount(35, Cache::store('array')->get('pos_sales_day:2026-10-16'));
    }

    public function test_exact_page_boundary_checks_next_day_and_cached_empty_days_count_toward_total(): void
    {
        Http::fake(function ($r) {
            $rows = str_starts_with($r['start_date'], '2026-10-16') ? array_map(fn ($id) => $this->sale($id), range(1, 10)) : [];
            return Http::response($rows);
        });
        $this->getJson('/api/ventas')->assertOk()->assertJsonPath('total', 10)->assertJsonPath('has_more', false)->assertJsonCount(10, 'data');
        Http::assertSentCount(7);
        $this->assertSame([], Cache::store('array')->get('pos_sales_day:2026-10-10'));
        $this->getJson('/api/ventas')->assertOk()->assertJsonPath('total', 10);
        $this->getJson('/api/ventas?page=2')->assertOk()->assertJsonPath('page', 2)->assertJsonCount(0, 'data')->assertJsonPath('has_more', false);
        Http::assertSentCount(7);
    }

    public function test_filtered_search_loads_until_matching_rows_and_stops_without_scanning_month(): void
    {
        Http::fake(function ($r) {
            $day = substr($r['start_date'], 0, 10);
            $credit = $day === '2026-10-15';
            return Http::response(array_map(fn ($id) => $this->sale((int) substr($day, 8) * 100 + $id, $day, [
                'customer_first_name' => $credit ? 'Cliente objetivo' : 'Otro',
                'payments' => [['payment_type' => $credit ? 'Línea de crédito' : 'Efectivo']],
            ]), range(1, 12)));
        });
        $this->getJson('/api/ventas?desde=2026-09-16&hasta=2026-10-16&estado=A%20cr%C3%A9dito&q=objetivo&cliente_id=7')
            ->assertOk()->assertJsonPath('total', null)->assertJsonPath('has_more', true)->assertJsonCount(10, 'data')
            ->assertJsonPath('data.0.id', 1512);
        Http::assertSentCount(6); // Newest day, then one pool of five days, not all 31.
    }

    public function test_failing_day_in_pool_returns_no_data_and_is_never_cached(): void
    {
        Http::fake(fn ($r) => str_starts_with($r['start_date'], '2026-10-14') ? Http::response([], 503) : Http::response([]));
        $this->getJson('/api/ventas')->assertStatus(502)->assertJsonMissingPath('data');
        $this->assertNull(Cache::store('array')->get('pos_sales_day:2026-10-14'));
        $this->assertSame([], Cache::store('array')->get('pos_sales_day:2026-10-16'));
        Http::assertSentCount(6);
    }

    public function test_daily_ttls_and_location_isolation(): void
    {
        Http::fake(function ($r) {
            $date = substr($r['start_date'], 0, 10);
            return Http::response([$this->sale(1, $date)]);
        });
        $this->getJson('/api/ventas?desde=2026-10-16&hasta=2026-10-16')->assertOk();
        $this->getJson('/api/ventas?desde=2026-10-15&hasta=2026-10-15')->assertOk();
        $this->getJson('/api/ventas?desde=2026-10-16&hasta=2026-10-16&local_id=2')->assertOk();
        Http::assertSentCount(3);
        $this->assertNotNull(Cache::store('array')->get('pos_sales_day:2026-10-16:local:2'));
        CarbonImmutable::setTestNow(CarbonImmutable::now()->addSeconds(121));
        $this->getJson('/api/ventas?desde=2026-10-15&hasta=2026-10-15')->assertOk();
        $this->getJson('/api/ventas?desde=2026-10-16&hasta=2026-10-16')->assertOk();
        Http::assertSentCount(4);
        CarbonImmutable::setTestNow(CarbonImmutable::now()->addSeconds(1680));
        $this->getJson('/api/ventas?desde=2026-10-15&hasta=2026-10-15')->assertOk();
        Http::assertSentCount(5);
    }

    public function test_total_becomes_exact_if_remaining_days_are_already_cached(): void
    {
        for ($i = 10; $i < 16; $i++) Cache::store('array')->put('pos_sales_day:2026-10-'.$i, [], 60);
        Http::fake(['*' => Http::response(array_map(fn ($id) => $this->sale($id), range(1, 21)))]);
        $this->getJson('/api/ventas')->assertOk()->assertJsonPath('total', 21)->assertJsonPath('has_more', true);
        Http::assertSentCount(1);
    }

    public function test_connection_is_retried_once_but_timeouts_and_http_errors_are_not(): void
    {
        foreach ([7 => 2, 28 => 1] as $errno => $expected) {
            Cache::store('array')->flush();
            Http::swap(new \Illuminate\Http\Client\Factory());
            $attempts = 0;
            Http::fake(function () use (&$attempts, $errno) {
                $attempts++;
                throw new ConnectionException('SECRET', 0, new ConnectException('SECRET', new Request('GET', 'https://pos.test'), null, ['errno' => $errno]));
            });
            $response = $this->getJson('/api/ventas?desde=2026-10-16&hasta=2026-10-16')->assertStatus(502);
            $this->assertStringNotContainsString('SECRET', $response->getContent());
            $this->assertSame($expected, $attempts);
        }
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake(['*' => Http::response([], 500)]);
        $this->getJson('/api/ventas?desde=2026-10-16&hasta=2026-10-16')->assertStatus(502);
        Http::assertSentCount(1);
    }

    public function test_optional_ca_timeouts_and_sanitized_per_call_timings(): void
    {
        config(['phppos.ca_bundle' => 'Z:/missing/windows-ca.pem']);
        Log::spy();
        Http::fake(function ($request, $options) {
            $this->assertSame(true, $options['verify']);
            $this->assertSame(25, $options['timeout']);
            $this->assertSame(10, $options['connect_timeout']);
            $options['on_stats'](new TransferStats(new Request('GET', 'https://pos.test'), new Response(200), .123));
            return Http::response([], 200, ['x-total-records' => '0']);
        });
        $this->getJson('/api/customers?search=private-name')->assertOk();
        Log::shouldHaveReceived('info')->withArgs(fn ($message, $context) => $message === 'phppos.request'
            && $context['duration_ms'] === 123.0 && $context['params']['search'] === '[redacted]'
            && !str_contains(json_encode($context), 'secret-test-key'))->once();
    }
}
