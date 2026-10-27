<?php
declare(strict_types=1);
namespace App\Enums;

enum Rol: string
{
    case Administrador = 'Administrador';
    case Vendedor = 'Vendedor';
    case Contador = 'Contador';

    public function permisos(): array
    {
        return match ($this) {
            self::Administrador => ['dashboard.ver', 'ventas.ver', 'reportes.ver', 'usuarios.gestionar'],
            self::Contador => ['dashboard.ver', 'ventas.ver', 'reportes.ver'],
            self::Vendedor => ['dashboard.ver', 'ventas.ver'],
        };
    }
}
