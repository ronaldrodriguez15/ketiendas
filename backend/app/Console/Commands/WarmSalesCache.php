<?php
declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Sales\SalesService;
use App\Integrations\PhpPos\PosException;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class WarmSalesCache extends Command
{
    protected $signature = 'phppos:warm-sales {--local= : Identificador del local}';
    protected $description = 'Precarga hoy y ayer sin guardar respuestas crudas del POS';

    public function handle(SalesService $service): int
    {
        $local = $this->option('local');
        if ($local !== null && (!ctype_digit((string) $local) || (int) $local < 1)) {
            $this->error('El local debe ser un entero positivo.'); return self::FAILURE;
        }
        $today = CarbonImmutable::now('America/Bogota');
        try {
            $result = $service->listing(array_filter(['desde' => $today->subDay()->format('Y-m-d'), 'hasta' => $today->format('Y-m-d'), 'local_id' => $local], fn ($v) => $v !== null));
            $this->info($result['meta']['parcial'] ? 'Precarga parcial; algunos días no estuvieron disponibles.' : 'Precarga completada.');
            return $result['meta']['parcial'] ? self::FAILURE : self::SUCCESS;
        } catch (PosException $error) { $this->error($error->getMessage()); return self::FAILURE; }
    }
}
