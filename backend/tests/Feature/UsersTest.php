<?php
declare(strict_types=1);
namespace Tests\Feature;
use App\Enums\Rol;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;
final class UsersTest extends TestCase
{
    use RefreshDatabase;
    private const PASSWORD = 'Inventada12345';
    private function account(Rol $rol = Rol::Administrador, array $extra = []): User
    {
        return User::factory()->create(array_merge(['rol' => $rol, 'password' => self::PASSWORD], $extra));
    }
    private function token(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }
    private function bearer(string $token): static
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($token);
    }
    private function fields(array $extra = []): array
    {
        return array_merge(['nombre' => 'Usuario Inventado', 'email' => 'inventado@example.test', 'rol' => 'Vendedor', 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD], $extra);
    }
    public function test_login_me_logout_and_generic_failures(): void
    {
        $user = $this->account();
        $response = $this->postJson('/api/login', ['email' => $user->email, 'password' => self::PASSWORD])->assertOk()->assertJsonPath('user.rol', 'Administrador');
        $this->assertNotNull($user->fresh()->ultimo_acceso);
        $token = $response->json('token');
        $this->bearer($token)->getJson('/api/me')->assertOk()->assertJsonPath('permisos.3', 'usuarios.gestionar')->assertJsonMissingPath('user.password');
        $this->bearer($token)->postJson('/api/logout')->assertNoContent();
        $this->bearer($token)->getJson('/api/me')->assertUnauthorized();
        foreach ([[$user->email, 'wrong'], ['absent@example.test', self::PASSWORD]] as [$email, $password]) {
            $this->postJson('/api/login', compact('email', 'password'))->assertUnprocessable()->assertJsonPath('message', 'Correo o contraseña incorrectos');
        }
        $user->update(['activo' => false]);
        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::PASSWORD])->assertUnprocessable()->assertJsonPath('message', 'Correo o contraseña incorrectos');
    }
    public function test_login_throttle_and_expiration(): void
    {
        for ($i = 0; $i < 5; $i++) $this->postJson('/api/login', ['email' => 'throttle@example.test', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => 'THROTTLE@example.test', 'password' => 'wrong'])->assertStatus(429);
        $token = $this->token($this->account());
        $this->travel(481)->minutes();
        $this->bearer($token)->getJson('/api/me')->assertUnauthorized();
    }
    public function test_routes_and_permissions(): void
    {
        $this->getJson('/api/usuarios')->assertUnauthorized();
        $this->get('/api/ventas')->assertUnauthorized()->assertJsonStructure(['message']);
        foreach ([Rol::Vendedor, Rol::Contador] as $role) {
            $token = $this->token($this->account($role));
            $this->bearer($token)->getJson('/api/usuarios')->assertForbidden();
            $this->bearer($token)->postJson('/api/usuarios', $this->fields())->assertForbidden();
            $this->bearer($token)->getJson('/api/usuarios/1')->assertForbidden();
            $this->bearer($token)->putJson('/api/usuarios/1', $this->fields())->assertForbidden();
            $this->bearer($token)->patchJson('/api/usuarios/1/activo', ['activo' => false])->assertForbidden();
            $this->bearer($token)->deleteJson('/api/usuarios/1')->assertForbidden();
            $this->bearer($token)->getJson('/api/me')->assertOk()->assertJsonPath('permisos.1', 'ventas.ver');
        }
    }
    public function test_admin_crud_pagination_filters_and_private_fields(): void
    {
        $admin = $this->account(); $token = $this->token($admin);
        $response = $this->bearer($token)->postJson('/api/usuarios', $this->fields())->assertCreated();
        $id = $response->json('data.id');
        $this->assertTrue(Hash::check(self::PASSWORD, User::findOrFail($id)->password));
        $this->assertSame(['id', 'nombre', 'email', 'rol', 'activo', 'ultimo_acceso', 'creado_en'], array_keys($response->json('data')));
        $this->bearer($token)->getJson('/api/usuarios/'.$id)->assertOk();
        $this->bearer($token)->putJson('/api/usuarios/'.$id, $this->fields(['nombre' => 'Editado Inventado', 'password' => '', 'password_confirmation' => '']))->assertOk()->assertJsonPath('data.nombre', 'Editado Inventado');
        User::factory()->count(12)->create(['rol' => Rol::Vendedor]);
        $this->bearer($token)->getJson('/api/usuarios?rol=Vendedor&per_page=10&page=2')->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 13);
        $this->bearer($token)->getJson('/api/usuarios?q=Editado&activo=true')->assertOk()->assertJsonCount(1, 'data');
        $this->bearer($token)->patchJson('/api/usuarios/'.$id.'/activo', ['activo' => false])->assertOk()->assertJsonPath('data.activo', false);
        $this->bearer($token)->getJson('/api/usuarios?activo=false')->assertJsonCount(1, 'data');
        $this->bearer($token)->patchJson('/api/usuarios/'.$id.'/activo', ['activo' => true])->assertOk();
        $this->bearer($token)->deleteJson('/api/usuarios/'.$id)->assertNoContent();
        $this->assertSoftDeleted('users', ['id' => $id]);
        $this->bearer($token)->getJson('/api/usuarios/'.$id)->assertNotFound();
    }
    public function test_self_and_last_admin_protection(): void
    {
        $admin = $this->account(); $token = $this->token($admin);
        $this->bearer($token)->patchJson('/api/usuarios/'.$admin->id.'/activo', ['activo' => false])->assertForbidden();
        $this->bearer($token)->deleteJson('/api/usuarios/'.$admin->id)->assertForbidden();
        $this->bearer($token)->putJson('/api/usuarios/'.$admin->id, $this->fields(['email' => $admin->email]))->assertStatus(409);
        $other = $this->account();
        $this->bearer($token)->putJson('/api/usuarios/'.$admin->id, $this->fields(['email' => $admin->email, 'password' => '', 'password_confirmation' => '']))->assertOk();
        $this->bearer($token)->getJson('/api/usuarios')->assertForbidden();
        $this->assertSame(Rol::Administrador, $other->fresh()->rol);
    }
    public function test_tokens_revoked_on_password_deactivation_and_deletion(): void
    {
        $adminToken = $this->token($this->account());
        foreach (['password', 'activo', 'delete'] as $action) {
            $target = $this->account(Rol::Vendedor); $targetToken = $this->token($target); $this->token($target);
            if ($action === 'password') $this->bearer($adminToken)->putJson('/api/usuarios/'.$target->id, $this->fields(['email' => $target->email]))->assertOk();
            elseif ($action === 'activo') $this->bearer($adminToken)->patchJson('/api/usuarios/'.$target->id.'/activo', ['activo' => false])->assertOk();
            else $this->bearer($adminToken)->deleteJson('/api/usuarios/'.$target->id)->assertNoContent();
            $this->assertSame(0, $target->tokens()->count());
            $this->bearer($targetToken)->getJson('/api/me')->assertUnauthorized();
        }
        $inactive = $this->account(Rol::Vendedor, ['activo' => false]);
        $this->bearer($this->token($inactive))->getJson('/api/me')->assertUnauthorized();
    }
    public function test_validation_and_seeder_are_safe(): void
    {
        $admin = $this->account(); $token = $this->token($admin);
        $this->bearer($token)->postJson('/api/usuarios', $this->fields(['password' => 'weak', 'email' => $admin->email, 'rol' => 'Root', 'nombre' => 'A']))->assertUnprocessable()->assertJsonValidationErrors(['password', 'email', 'rol', 'nombre']);
        $this->bearer($token)->getJson('/api/usuarios?per_page=8')->assertUnprocessable();
        config(['admin' => ['nombre' => 'Admin Inventado', 'email' => 'seed@example.test', 'password' => self::PASSWORD]]);
        $this->seed(AdminUserSeeder::class); $this->seed(AdminUserSeeder::class);
        $this->assertSame(1, User::where('email', 'seed@example.test')->count());
        $this->assertSame(Rol::Administrador, User::where('email', 'seed@example.test')->first()->rol);
    }
    public function test_bearer_authentication_reaches_sales_without_real_pos_calls(): void
    {
        config(['phppos.cache_store' => 'array', 'phppos.url' => 'https://pos.test', 'phppos.key' => 'fake']);
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response([], 200, ['x-total-records' => '0'])]);
        $this->bearer($this->token($this->account(Rol::Vendedor)))->getJson('/api/ventas?desde=2026-10-08&hasta=2026-10-08')->assertOk();
    }

    public function test_deleted_user_cannot_login_and_cors_allows_bearer_mutations(): void
    {
        $user = $this->account(); $user->delete();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::PASSWORD])->assertUnprocessable()->assertJsonPath('message', 'Correo o contraseña incorrectos');
        $this->options('/api/usuarios', [], ['Origin' => 'http://localhost:5173', 'Access-Control-Request-Method' => 'PUT', 'Access-Control-Request-Headers' => 'Authorization,Content-Type'])
            ->assertNoContent()->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->options('/api/usuarios', [], ['Origin' => 'https://untrusted.example', 'Access-Control-Request-Method' => 'DELETE'])
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }
}
