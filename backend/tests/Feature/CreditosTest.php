<?php
declare(strict_types=1);
namespace Tests\Feature;
use App\Models\User;
use App\Services\Sales\SaleMapper;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CreditosTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'test']);
        Cache::store('array')->flush(); Http::preventStrayRequests();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-16 12:00', 'America/Bogota'));
    }
    protected function tearDown(): void { CarbonImmutable::setTestNow(); parent::tearDown(); }
    private function row(int $id, ?int $customer = 3, array $extra = []): array
    {
        return (new SaleMapper())->map(array_replace(['sale_id' => $id, 'sale_time' => '31-08-2026 09:00 am', 'total' => 100,
            'customer_id' => $customer, 'customer_first_name' => 'Same name',
            'payments' => [['payment_type' => 'Línea de crédito', 'payment_amount' => 60], ['payment_type' => 'Efectivo', 'payment_amount' => 40]]], $extra));
    }
    public function test_groups_complete_period_before_pagination_and_fetches_balance_only_for_detail(): void
    {
        Sanctum::actingAs(new User());
        Cache::store('array')->put('pos_sales_day:2026-08-31', [...array_map(fn ($id) => $this->row($id), range(1, 12)), $this->row(13, 4)], 300);
        $range = '?desde=2026-08-31&hasta=2026-08-31';
        $this->getJson('/api/creditos'.$range.'&per_page=1')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.cliente_id', 4)->assertJsonMissingPath('data.0.ventas');
        $this->getJson('/api/creditos'.$range.'&per_page=1&page=2')->assertOk()->assertJsonPath('data.0.cantidad', 12)->assertJsonPath('data.0.total_ventas', 1200)->assertJsonPath('data.0.total_credito', 720);
        Http::assertNothingSent();
        Http::fake(['*/customers/3' => Http::response(['person_id' => 3, 'balance' => 250])]);
        $this->getJson('/api/creditos/cliente-3'.$range)->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('resumen.saldo_actual', 250)->assertJsonPath('resumen.total_credito', 720)->assertJsonPath('meta.has_more', true);
        $this->getJson('/api/creditos/cliente-3'.$range.'&page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.has_more', false);
        Http::assertSentCount(1);
    }
    public function test_unknown_clients_stay_separate_and_unknown_amounts_are_not_zero(): void
    {
        Sanctum::actingAs(new User());
        Cache::store('array')->put('pos_sales_day:2026-08-31', [$this->row(1, null), $this->row(2, null, ['payments' => [['payment_type' => 'Línea de crédito']]])], 300);
        $range = '?desde=2026-08-31&hasta=2026-08-31';
        $this->getJson('/api/creditos'.$range)->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.total_credito', null);
        $this->getJson('/api/creditos/venta-2'.$range)->assertOk()->assertJsonPath('resumen.saldo_actual', null)->assertJsonCount(1, 'data');
        $this->getJson('/api/creditos/cliente-99'.$range)->assertNotFound(); Http::assertNothingSent();
    }
    public function test_auth_range_and_failures_are_enforced(): void
    {
        $this->getJson('/api/creditos')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->getJson('/api/creditos?desde=2020-01-01&hasta=2026-10-16')->assertUnprocessable();
        Http::fake(['*' => Http::response([], 503)]);
        $this->getJson('/api/creditos?desde=2026-08-31&hasta=2026-08-31')->assertStatus(502)->assertJsonMissingPath('data');
    }
}
