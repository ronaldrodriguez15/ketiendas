<?php
declare(strict_types=1);
namespace Tests\Feature;
use App\Models\User;
use App\Services\Sales\SaleMapper;
use App\Services\Sales\SalesService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class SalesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.url' => 'https://pos.test', 'phppos.key' => 'invented-test-key', 'phppos.cache_store' => 'array']);
        Cache::store('array')->flush();
        Http::preventStrayRequests();
        Sanctum::actingAs(new User(['name' => 'Inventado']));
    }
    private function sale(int $id = 1, array $extra = []): array
    {
        return array_replace(['sale_id' => $id, 'sale_time' => '08-10-2026 04:28 pm', 'total' => '4000000', 'customer_id' => 7,
            'customer_first_name' => 'Cliente', 'customer_last_name' => 'Inventado', 'deleted' => false, 'suspended' => '0', 'mode' => 'sale',
            'payments' => [['payment_type' => 'Efectivo']], 'cart_items' => [['quantity' => 2, 'description' => '<p>PRIVATE</p>']],
            'customer_phone_number' => '555-0100', 'customer_email' => 'fake@example.test'], $extra);
    }
    public function test_mapper_formats_and_state_priority(): void
    {
        $mapper = new SaleMapper();
        $row = $mapper->map($this->sale());
        $this->assertSame('2026-10-08T16:28:00-05:00', $row['fecha']);
        $this->assertSame(4000000, $row['total']);
        $this->assertSame(2, $row['items']);
        foreach ([['Pagada', []], ['Anulada', ['deleted' => true, 'total' => '-1']], ['Devolución', ['total' => '-1', 'suspended' => '1']], ['Devolución', ['return_sale_id' => 5]], ['Suspendida', ['suspended' => '1', 'mode' => 'store_account_payment']], ['Abono', ['mode' => 'store_account_payment']], ['A crédito', ['payments' => [['payment_type' => 'Línea de crédito']]]]] as [$state, $extra]) {
            $this->assertSame($state, $mapper->map($this->sale(1, $extra))['estado']);
        }
        $this->assertSame('Sin cliente', $mapper->map($this->sale(1, ['customer_first_name' => '', 'customer_last_name' => '']))['cliente']);
    }
    public function test_pagination_filters_totals_cache_and_whitelist(): void
    {
        $rows = array_map(fn ($id) => $this->sale($id), range(1, 23));
        $rows[] = $this->sale(24, ['suspended' => '1']);
        Http::fake(['pos.test/*' => Http::response($rows, 200, ['x-total-records' => '24'])]);
        $url = '/api/ventas?desde=2026-10-08&hasta=2026-10-08';
        $response = $this->getJson($url.'&page=2&per_page=10')->assertOk()->assertJsonPath('meta.total', 24)->assertJsonPath('meta.last_page', 3)->assertJsonPath('meta.total_cobrado', 92000000)->assertJsonCount(10, 'data');
        $this->assertLessThan(15000, strlen($response->getContent()));
        $this->assertSame(['id', 'fecha', 'cliente', 'total', 'forma_pago', 'items', 'estado', 'recibo_url'], array_keys($response->json('data.0')));
        $this->assertStringNotContainsString('PRIVATE', $response->getContent());
        $this->getJson($url.'&q=24&estado=Suspendida&cliente_id=7')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('meta.total_cobrado', 0);
        $this->getJson($url.'&q=Inventado')->assertOk()->assertJsonPath('meta.total', 24);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->method() === 'GET' && !isset($request['limit']) && !isset($request['offset']));
        $cached = Cache::store('array')->get('pos_sales_day:2026-10-08');
        $this->assertArrayNotHasKey('cart_items', $cached[0]);
    }
    public function test_failed_day_is_an_error_and_not_cached(): void
    {
        Http::fake(fn ($request) => str_starts_with($request['start_date'], '2026-10-08') ? Http::response([$this->sale()], 200, ['x-total-records' => '1']) : Http::response([], 503));
        $this->getJson('/api/ventas?desde=2026-10-08&hasta=2026-10-09')->assertStatus(502)->assertJsonMissingPath('data');
        $this->assertNull(Cache::store('array')->get('pos_sales_day:2026-10-09'));
    }
    public function test_all_failed_and_auth_errors_are_sanitized(): void
    {
        foreach ([401 => 502, 503 => 502] as $upstream => $status) {
            Http::swap(new \Illuminate\Http\Client\Factory());
            Http::fake(['*' => Http::response(['secret' => 'PRIVATE'], $upstream)]);
            $response = $this->getJson('/api/ventas?desde=2026-10-08&hasta=2026-10-08')->assertStatus($status);
            $this->assertStringNotContainsString('PRIVATE', $response->getContent());
        }
    }
    public function test_invalid_filters_do_not_call_pos(): void
    {
        foreach (['desde=2026-09-01&hasta=2026-10-09', 'desde=2026-10-09&hasta=2026-10-08', 'per_page=101'] as $query) $this->getJson('/api/ventas?'.$query)->assertUnprocessable();
        Http::assertNothingSent();
    }
    public function test_single_daily_response_and_truncation_is_rejected(): void
    {
                Http::fake(['*' => Http::response([$this->sale(1), $this->sale(2), $this->sale(3)], 200, ['x-total-records' => '3'])]);
        $this->getJson('/api/ventas?desde=2026-10-08&hasta=2026-10-08')->assertOk()->assertJsonPath('meta.total', 3);
        Http::assertSentCount(1);
        Cache::store('array')->flush();
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake(['*' => Http::response([$this->sale(1), $this->sale(2)], 200, ['x-total-records' => '3'])]);
        $this->getJson('/api/ventas?desde=2026-10-08&hasta=2026-10-08')->assertStatus(502);
        $this->assertNull(Cache::store('array')->get('pos_sales_day:2026-10-08'));
    }

    public function test_hot_file_cache_endpoint_payload_and_latency(): void
    {
        config(['phppos.cache_store' => 'file']);
        $key = 'pos_sales_day:2026-10-08:local:987654321';
        $mapper = new SaleMapper();
        Cache::store('file')->put($key, array_map(fn ($id) => $mapper->map($this->sale($id)), range(1, 1000)), 60);
        try {
            $started = hrtime(true);
            $response = $this->getJson('/api/ventas?desde=2026-10-08&hasta=2026-10-08&local_id=987654321')->assertOk();
            $milliseconds = (hrtime(true) - $started) / 1e6;
            $bytes = strlen($response->getContent());
            $this->assertLessThan(15000, $bytes);
            $this->assertLessThan(300, $milliseconds);
            Http::assertNothingSent();
            fwrite(STDOUT, sprintf("\nHot file cache (1000 invented rows): %.1f ms; 10-row JSON: %d bytes\n", $milliseconds, $bytes));
        } finally {
            Cache::store('file')->forget($key);
        }
    }
}
