<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('rol')->default('Vendedor')->index();
            $table->boolean('activo')->default(true)->index();
            $table->timestamp('ultimo_acceso')->nullable();
            $table->softDeletes();
        });
    }
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['rol']);
            $table->dropIndex(['activo']);
            $table->dropColumn(['rol', 'activo', 'ultimo_acceso', 'deleted_at']);
        });
    }
};
