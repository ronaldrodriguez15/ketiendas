<?php
declare(strict_types=1);
namespace Database\Seeders;
use App\Enums\Rol;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
final class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $data = config('admin');
        $data['email'] = mb_strtolower(trim((string) ($data['email'] ?? '')));
        if ($data['email'] && User::withTrashed()->where('email', $data['email'])->exists()) {
            $this->command?->info('El correo inicial ya existe; no se modificó.');
            return;
        }
        if (Validator::make($data, ['nombre' => ['required', 'string', 'min:2', 'max:80'], 'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', Password::min(10)->mixedCase()->numbers()]])->fails()) {
            throw new \RuntimeException('Configura ADMIN_NOMBRE, ADMIN_EMAIL y ADMIN_PASSWORD válidos en el entorno.');
        }
        User::create(['name' => $data['nombre'], 'email' => $data['email'], 'password' => $data['password'], 'rol' => Rol::Administrador, 'activo' => true]);
    }
}
