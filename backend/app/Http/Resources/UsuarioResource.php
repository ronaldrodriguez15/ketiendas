<?php
declare(strict_types=1);
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
final class UsuarioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'nombre' => $this->name, 'email' => $this->email,
            'rol' => $this->rol->value, 'activo' => $this->activo,
            'ultimo_acceso' => $this->ultimo_acceso?->toIso8601String(), 'creado_en' => $this->created_at?->toIso8601String()];
    }
}
