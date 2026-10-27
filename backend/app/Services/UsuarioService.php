<?php
declare(strict_types=1);
namespace App\Services;
use App\Enums\Rol;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class UsuarioService
{
    public function create(User $actor, array $data): User
    {
        return DB::transaction(function () use ($actor, $data) {
            $user = User::create(['name' => $data['nombre'], 'email' => $data['email'], 'rol' => $data['rol'], 'password' => $data['password']]);
            $this->audit('creado', $actor, $user);
            return $user;
        });
    }
    public function change(User $actor, User $target, array $data = [], bool $delete = false): User
    {
        return DB::transaction(function () use ($actor, $target, $data, $delete) {
            // Same lock order for all mutations prevents concurrent removals of the last admins.
            $admins = User::where('rol', Rol::Administrador->value)->where('activo', true)->orderBy('id')->lockForUpdate()->get();
            $user = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            $deactivate = array_key_exists('activo', $data) && !$data['activo'];
            abort_if($actor->id === $user->id && ($delete || $deactivate), 403, 'No puedes desactivarte ni eliminarte a ti mismo.');
            $demote = isset($data['rol']) && $data['rol'] !== Rol::Administrador->value;
            abort_if($user->activo && $user->rol === Rol::Administrador && $admins->count() <= 1 && ($delete || $deactivate || $demote), 409, 'Debe existir al menos un administrador activo.');
            if ($delete) {
                $user->tokens()->delete();
                $user->delete();
            } else {
                $values = array_intersect_key($data, array_flip(['email', 'rol', 'activo']));
                if (isset($data['nombre'])) $values['name'] = $data['nombre'];
                if (!empty($data['password'])) $values['password'] = $data['password'];
                $user->fill($values)->save();
                if ($deactivate || !empty($data['password'])) $user->tokens()->delete();
            }
            $this->audit($delete ? 'eliminado' : ($deactivate ? 'desactivado' : 'editado'), $actor, $user);
            return $user;
        }, 3);
    }
    private function audit(string $action, User $actor, User $target): void
    {
        DB::afterCommit(fn () => Log::info('usuario.'.$action, ['actor_id' => $actor->id, 'usuario_id' => $target->id]));
    }
}
