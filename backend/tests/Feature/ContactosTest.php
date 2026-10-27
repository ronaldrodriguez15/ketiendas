<?php
declare(strict_types=1);
namespace Tests\Feature;

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class ContactosTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['phppos.url' => 'https://pos.test', 'phppos.key' => 'private-test-key', 'phppos.cache_store' => 'array']);
        Cache::store('array')->flush();
        Http::preventStrayRequests();
    }

    private function row(int $id = 7): array
    {
        return ['person_id' => (string) $id, 'first_name' => 'Ana', 'last_name' => 'Prueba',
            'company_name' => 'Empresa de prueba', 'email' => 'ana@example.test', 'phone_number' => '5550100',
            'account_number' => '00123', 'address_1' => 'Dirección de prueba', 'city' => 'Bogotá',
            'balance' => '1500.75', 'credit_limit' => '8000.50', 'points' => '0', 'private_key' => 'private-test-key',
            'custom_field_1_value' => 'No exponer', 'password' => 'PRIVATE'];
    }

    public function test_both_directories_use_remote_pagination_header_and_whitelisted_fields(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['pos.test/*' => Http::response([$this->row()], 200, ['x-total-records' => '21'])]);
        foreach (['customers', 'suppliers'] as $kind) {
            $response = $this->getJson('/api/'.$kind.'?page=3&per_page=10&search=Ana&search_field=first_name&sort_col=balance&sort_dir=desc&unexpected=ignored')
                ->assertOk()->assertJsonPath('total', 21)->assertJsonPath('page', 3)->assertJsonPath('per_page', 10)->assertJsonPath('has_more', false)
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.person_id', 7)->assertJsonPath('data.0.balance', 1500.75)
                ->assertJsonPath('data.0.account_number', '00123');
            $this->assertStringNotContainsString('private-test-key', $response->getContent());
            $this->assertStringNotContainsString('PRIVATE', $response->getContent());
            $this->assertStringNotContainsString('custom_field', $response->getContent());
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            if ($kind === 'customers') $response->assertJsonPath('data.0.credit_limit', 8000.5)->assertJsonPath('data.0.points', 0);
            else $this->assertArrayNotHasKey('credit_limit', $response->json('data.0'));
            Http::assertSent(fn ($r) => str_starts_with($r->url(), 'https://pos.test/'.$kind.'?')
                && $r->method() === 'GET' && $r->hasHeader('x-api-key', 'private-test-key')
                && $r['offset'] === 20 && $r['limit'] === 10 && $r['search'] === 'Ana'
                && $r['search_field'] === 'first_name' && $r['sort_col'] === 'balance' && $r['sort_dir'] === 'desc' && !isset($r['unexpected']));
        }
        Http::assertSentCount(2);
    }

    public function test_defaults_empty_results_and_customer_location_filter(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*' => Http::response([], 200, ['x-total-records' => '0'])]);
        $this->getJson('/api/customers?location_id=3&search_field=custom_field_10_value')->assertOk()
            ->assertExactJson(['data' => [], 'total' => 0, 'page' => 1, 'per_page' => 10, 'has_more' => false]);
        Http::assertSent(fn ($r) => $r['location_id'] === 3 && $r['search_field'] === 'custom_field_10_value' && $r['offset'] === 0 && $r['limit'] === 10);
        $this->getJson('/api/suppliers?search=Empresa&search_field=company_name')->assertOk();
        Http::assertSentCount(2);
    }

    public function test_details_are_fetched_individually_with_normalized_fields(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(['*' => Http::response(array_replace($this->row(), ['balance' => null, 'first_name' => '<b>Ana</b>']), 200)]);
        foreach (['customers', 'suppliers'] as $kind) {
            $response = $this->getJson('/api/'.$kind.'/7')->assertOk()->assertJsonPath('data.person_id', 7)
                ->assertJsonPath('data.first_name', 'Ana')->assertJsonPath('data.balance', null)->assertJsonPath('data.city', 'Bogotá');
            $this->assertStringNotContainsString('private-test-key', $response->getContent());
            Http::assertSent(fn ($r) => $r->url() === 'https://pos.test/'.$kind.'/7' && $r->method() === 'GET');
        }
        Http::assertSentCount(2);
    }

    public function test_invalid_parameters_never_reach_the_pos(): void
    {
        Sanctum::actingAs(new User());
        foreach (['per_page=101', 'per_page=0', 'page=0', 'page=1.5', 'sort_col=password', 'sort_dir=sideways',
            'search_field=custom_field_11_value', 'search[]=value', 'search='.str_repeat('a', 121), 'location_id=0'] as $query) {
            $this->getJson('/api/customers?'.$query)->assertUnprocessable();
        }
        $this->getJson('/api/customers?search_field=company_name')->assertUnprocessable();
        $this->getJson('/api/suppliers?location_id=1')->assertUnprocessable();
        $this->getJson('/api/suppliers?sort_dir=sideways')->assertUnprocessable();
        $this->getJson('/api/customers/0')->assertNotFound();
        $this->getJson('/api/suppliers/not-an-id')->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_authentication_active_account_and_read_only_routes(): void
    {
        foreach (['customers', 'suppliers'] as $kind) {
            $this->getJson('/api/'.$kind)->assertUnauthorized();
            $this->getJson('/api/'.$kind.'/7')->assertUnauthorized();
        }
        Sanctum::actingAs(new User(['activo' => false]));
        $this->getJson('/api/customers')->assertUnauthorized();
        Sanctum::actingAs(new User());
        $this->postJson('/api/customers', [])->assertStatus(405);
        $this->deleteJson('/api/suppliers/7')->assertStatus(405);
        Http::assertNothingSent();
    }

    public function test_upstream_errors_are_sanitized_and_logged_without_secrets(): void
    {
        Sanctum::actingAs(new User());
        Log::spy();
        foreach ([400 => 422, 401 => 502, 403 => 502, 404 => 404, 500 => 502] as $remote => $local) {
            Http::swap(new \Illuminate\Http\Client\Factory());
            Http::fake(['*' => Http::response(['message' => 'private-test-key PRIVATE', 'code' => 99], $remote)]);
            $response = $this->getJson('/api/customers/7')->assertStatus($local);
            $this->assertStringNotContainsString('private-test-key', $response->getContent());
            $this->assertStringNotContainsString('PRIVATE', $response->getContent());
        }
        Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context) => $message === 'phppos.error'
            && array_keys($context) === ['path', 'kind'] && $context['path'] === '/customers/7')->times(5);
    }

    public function test_timeout_missing_total_and_malformed_payload_fail_clearly(): void
    {
        Sanctum::actingAs(new User());
        Http::fake(fn () => throw new ConnectionException('private-test-key'));
        $response = $this->getJson('/api/suppliers')->assertStatus(502);
        $this->assertStringNotContainsString('private-test-key', $response->getContent());
        foreach ([[[$this->row()], []], [[['name' => 'Missing ID']], ['x-total-records' => '1']],
            [[], ['x-total-records' => 'invalid']], [[$this->row(), $this->row(8)], ['x-total-records' => '2']]] as [$rows, $headers]) {
            Http::swap(new \Illuminate\Http\Client\Factory());
            Http::fake(['*' => Http::response($rows, 200, $headers)]);
            $this->getJson('/api/suppliers?per_page=1')->assertStatus(502);
        }
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake(['*' => Http::response($this->row(8), 200)]);
        $this->getJson('/api/customers/7')->assertStatus(502);
    }
}
