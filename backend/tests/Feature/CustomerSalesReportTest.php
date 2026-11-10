<?php
declare(strict_types=1);
namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CustomerSalesReportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'test']);
        Cache::store('array')->flush(); Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-30 12:00', 'America/Bogota'));
    }
    protected function tearDown(): void { CarbonImmutable::setTestNow(); parent::tearDown(); }
    private function sale(int $id, array $extra = []): array
    {
        return array_replace(['sale_id' => $id, 'sale_time' => '01-10-2026 09:00 am', 'customer_id' => 3,
            'customer_first_name' => 'María', 'customer_phone_number' => '555123', 'customer_address_1' => 'Calle 1',
            'subtotal' => 100.5, 'tax' => 19.095, 'total' => 119.595, 'profit' => 30.25,
            'payments' => [['payment_type' => 'Efectivo', 'payment_amount' => 119.595]],
            'cart_items' => [['item_id' => 12, 'quantity' => 2.5]], 'customer_internal_notes' => 'never expose'], $extra);
    }
    public function test_aggregates_original_metrics_returns_and_fractional_quantities_before_pagination(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*/sales*' => Http::response([
            $this->sale(1), $this->sale(2),
            $this->sale(3, ['subtotal' => -10, 'tax' => -1.9, 'total' => -11.9, 'profit' => -3, 'cart_items' => [['item_id' => 12, 'quantity' => -1], ['item_id' => 13, 'quantity' => -1]]]),
            $this->sale(4, ['deleted' => true]), $this->sale(5, ['suspended' => '1']),
            $this->sale(6, ['store_account_payment' => true, 'subtotal' => 0, 'tax' => 0, 'total' => 0, 'profit' => 0]), $this->sale(7, ['customer_id' => null]),
            $this->sale(8, ['customer_id' => 4, 'customer_first_name' => 'Ana', 'profit' => null]),
        ]), '*/items/12' => Http::response(['item_id' => 12, 'is_service' => false]),
            '*/items/13' => Http::response(['item_id' => 13, 'is_service' => true])]);
        $url = '/api/reportes/ventas-clientes?desde=2026-10-01&hasta=2026-10-01';
        $this->getJson($url.'&per_page=1')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.cliente', 'Ana')->assertJsonPath('data.0.profit', null);
        $response = $this->getJson($url.'&q=maria')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.transactions', 4)->assertJsonPath('data.0.subtotal', 191)
            ->assertJsonPath('data.0.profit', 57.5)->assertJsonPath('data.0.address_1', 'Calle 1')
            ->assertJsonMissingPath('data.0.customer_internal_notes');
        $this->assertEqualsWithDelta(227.29, $response->json('data.0.total'), .00001);
        $this->assertEqualsWithDelta(227.29 / 4, $response->json('data.0.average_receipt'), .00001);
        $this->assertEqualsWithDelta(1, $response->json('data.0.average_quantity'), .00001);
        Http::assertSentCount(3);
    }
    public function test_default_period_is_thirty_days_and_contacts_are_not_requested(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*/sales*' => Http::response([])]);
        $this->getJson('/api/reportes/ventas-clientes')->assertOk()
            ->assertJsonPath('meta.desde', '2026-10-01')->assertJsonPath('meta.hasta', '2026-10-30')->assertJsonPath('meta.total', 0);
        Http::assertSentCount(30);
        Http::assertSent(fn ($r) => $r['start_date'] === '2026-10-01T05:00:00Z');
        Http::assertSent(fn ($r) => $r['end_date'] === '2026-10-31T04:59:59Z');
        $this->getJson('/api/reportes/ventas-clientes?q=ana')->assertOk();
        Http::assertSentCount(30);
    }
    public function test_auth_validation_and_failed_days_never_become_empty_results(): void
    {
        $this->getJson('/api/reportes/ventas-clientes')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->getJson('/api/reportes/ventas-clientes?desde=2026-01-01&hasta=2026-10-30')->assertUnprocessable();
        Http::fake(['*' => Http::response([], 503)]);
        $this->getJson('/api/reportes/ventas-clientes?desde=2026-10-01&hasta=2026-10-01')->assertStatus(502)->assertJsonMissingPath('data');
    }
    public function test_truncated_sales_are_rejected_instead_of_showing_incomplete_totals(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*/sales*' => Http::response([$this->sale(1)], 200, ['x-total-records' => '100'])]);
        $this->getJson('/api/reportes/ventas-clientes?desde=2026-10-01&hasta=2026-10-01')
            ->assertStatus(502)->assertJsonMissingPath('data');
    }

    public function test_latest_contact_wins_and_legacy_sales_cache_is_upgraded(): void
    {
        Sanctum::actingAs(new User());
        Cache::store('array')->put('pos_sales_day:2026-10-01', [['id' => 1]], 300);
        Http::fake(['*/sales*' => fn ($request) => Http::response([
            str_starts_with($request['start_date'], '2026-10-01') ? $this->sale(1, ['customer_phone_number' => 'old'])
                : $this->sale(2, ['sale_time' => '02-10-2026 09:00 am', 'customer_phone_number' => 'new']),
        ]), '*/items/12' => Http::response(['item_id' => 12, 'is_service' => false])]);
        $this->getJson('/api/reportes/ventas-clientes?desde=2026-10-01&hasta=2026-10-02')
            ->assertOk()->assertJsonPath('data.0.phone_number', 'new')->assertJsonPath('data.0.transactions', 2);
        $this->assertArrayHasKey('_report', Cache::store('array')->get('pos_sales_day:2026-10-01')[0]);
        Http::assertSentCount(3);
    }
}
