<?php
declare(strict_types=1);
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UsuarioController;
use App\Http\Controllers\VentaController;
use Illuminate\Support\Facades\Route;



Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::middleware(['auth:sanctum', 'activo', 'throttle:60,1'])->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    foreach (['customers', 'suppliers'] as $resource) {
        Route::get('/'.$resource, [\App\Http\Controllers\ContactoController::class, 'index'])->name($resource.'.index')->middleware('can:ventas.ver');
        Route::get('/'.$resource.'/{id}', [\App\Http\Controllers\ContactoController::class, 'show'])->whereNumber('id')->name($resource.'.show')->middleware('can:ventas.ver');
    }
    Route::get('/cierre', \App\Http\Controllers\CierreController::class)->middleware('can:ventas.ver');
    Route::get('/creditos', [\App\Http\Controllers\CreditoController::class, 'index'])->middleware('can:ventas.ver');
    Route::get('/creditos/{id}', [\App\Http\Controllers\CreditoController::class, 'show'])->where('id', '(cliente|venta)-[0-9]+')->middleware('can:ventas.ver');
    Route::get('/ventas', [VentaController::class, 'index'])->middleware('can:ventas.ver');
    Route::get('/ventas/resumen', [VentaController::class, 'summary'])->middleware('can:ventas.ver');
    Route::get('/ventas/{id}', [VentaController::class, 'show'])->whereNumber('id')->middleware('can:ventas.ver');
    Route::middleware('can:usuarios.gestionar')->group(function (): void {
        Route::patch('/usuarios/{usuario}/activo', [UsuarioController::class, 'activo']);
        Route::apiResource('usuarios', UsuarioController::class)->parameters(['usuarios' => 'usuario']);
    });
});
