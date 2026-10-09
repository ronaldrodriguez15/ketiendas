<?php
declare(strict_types=1);

use App\Http\Controllers\VentaController;
use Illuminate\Support\Facades\Route;

// TODO: Connect the simulated React login to real Sanctum authentication before deployment.
// Never remove this protection to make the demo login work with real sales.
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function (): void {
    Route::get('/ventas', [VentaController::class, 'index']);
    Route::get('/ventas/{id}', [VentaController::class, 'show'])->whereNumber('id');
});
