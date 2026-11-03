import fs from 'fs';
import path from 'path';
import { Licencia, LicenciasData } from './interfaces/licencia.interface';
import { publicar } from './mensajeria/publicador';
import { ROUTING_KEYS } from './mensajeria/topologia';

const LICENCIAS_PATH = path.join(process.cwd(), 'data', 'licencias.json');
const MS_AUDITORIA_URL = process.env.MS_AUDITORIA_URL ?? 'http://localhost:3001/internal/auditoria';

function leerLicencias(): LicenciasData {
  if (!fs.existsSync(LICENCIAS_PATH)) return { licencias: [] };
  const raw = fs.readFileSync(LICENCIAS_PATH, 'utf-8');
  return JSON.parse(raw) as LicenciasData;
}

function guardarLicencias(data: LicenciasData): void {
  fs.writeFileSync(LICENCIAS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function listarTodas(): Licencia[] {
  return leerLicencias().licencias;
}

export async function revocar(
  licenciaId: number,
  adminSub: string,
  motivo: string = '',
  authorization?: string
): Promise<Licencia | null> {
  const dataLicencias = leerLicencias();
  const licencia = dataLicencias.licencias.find(l => l.id === licenciaId);
  
  if (!licencia || licencia.revocado) return null;

  // 1. Borrado lógico local
  licencia.revocado = true;
  guardarLicencias(dataLicencias);

  // 2. Emisión asincrónica del evento de dominio en RabbitMQ
  publicar(ROUTING_KEYS.licenciaRevocada, {
    licenciaId,
    juegoId: licencia.juegoId,
    usuarioSub: licencia.usuarioSub,
    revocadaPor: adminSub,
    motivo,
    revocadaEn: new Date().toISOString(),
  });

  // 3. Propagación HTTP síncrona a ms-auditoria (:3001/internal/auditoria)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authorization) headers['Authorization'] = authorization;

    const res = await fetch(MS_AUDITORIA_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        licenciaId,
        adminSub,
        usuarioAfectado: licencia.usuarioSub,
        juegoId: licencia.juegoId,
        motivo,
      }),
    });

    if (!res.ok) {
      console.error(`[AUDITORIA] Fallo al registrar revocación. Código: ${res.status}`);
    }
  } catch (error) {
    console.error(`[AUDITORIA] Error de conexión con ms-auditoria:`, (error as Error).message);
  }

  return licencia;
}
