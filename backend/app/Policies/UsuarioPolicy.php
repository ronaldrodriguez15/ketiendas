<?php
declare(strict_types=1);
namespace App\Policies;
use App\Enums\Rol;
use App\Models\User;
final class UsuarioPolicy
{
    public function viewAny(User $user): bool { return $user->activo && $user->rol === Rol::Administrador; }
    public function view(User $user, User $target): bool { return $this->viewAny($user); }
    public function create(User $user): bool { return $this->viewAny($user); }
    public function update(User $user, User $target): bool { return $this->viewAny($user); }
    public function delete(User $user, User $target): bool { return $this->viewAny($user); }
}
