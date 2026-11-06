import fs from 'fs';
import path from 'path';
import { Licencia, LicenciasData } from './interfaces/licencia.interface';
import { JuegoBiblioteca } from './interfaces/juego-biblioteca.interface';
import { publicar } from './mensajeria/publicador';
import { ROUTING_KEYS } from './mensajeria/topologia';
import { publicarEventoKafka } from './kafka/productor';

const LICENCIAS_PATH = path.join(process.cwd(), 'data', 'licencias.json');
const MS_CATALOGO_URL = process.env.MS_CATALOGO_URL ?? 'http://localhost:3001';

interface JuegoCatalogo {
  id: number;
  titulo: string;
  genero: string;
  precio: number;
  stock: number;
  portada?: string;
}

function leerLicencias(): LicenciasData {
  if (!fs.existsSync(LICENCIAS_PATH)) return { licencias: [] };
  return JSON.parse(fs.readFileSync(LICENCIAS_PATH, 'utf8')) as LicenciasData;
}

function guardarLicencias(data: LicenciasData): void {
  fs.writeFileSync(LICENCIAS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function obtenerCatalogoHttp(authorization?: string): Promise<JuegoCatalogo[]> {
  const headers: Record<string, string> = {};
  if (authorization) headers['Authorization'] = authorization;

  const res = await fetch(`${MS_CATALOGO_URL}/internal/catalogo`, { headers });
  if (!res.ok) {
    throw new Error(`Error al consultar catálogo HTTP (${res.status})`);
  }
  const data = (await res.json()) as { juegos?: JuegoCatalogo[] };
  return data.juegos ?? [];
}

export async function listarBiblioteca(
  usuarioSub: string,
  authorization?: string,
): Promise<JuegoBiblioteca[]> {
  const licencias = leerLicencias().licencias || [];
  const juegos = await obtenerCatalogoHttp(authorization);

  const activas = licencias.filter(l => l.usuarioSub === usuarioSub && l.revocado === false);

  return activas.map(l => {
    const juego = juegos.find(j => j.id === l.juegoId);
    return {
      licenciaId: l.id,
      juegoId: l.juegoId,
      titulo: juego?.titulo ?? 'Juego no disponible',
      genero: juego?.genero ?? '-',
      portada: juego?.portada ?? '',
      creadaEn: l.creadaEn,
    };
  });
}

export async function procesarCompra(
  usuarioSub: string,
  juegoId: number,
  authorization?: string,
): Promise<{ error: boolean; code?: number; message?: string; licencia?: Licencia }> {
  const licenciasData = leerLicencias();
  const licencias = licenciasData.licencias || [];

  const yaLoTiene = licencias.find(l => l.juegoId === juegoId && l.usuarioSub === usuarioSub && !l.revocado);
  if (yaLoTiene) {
    return { error: true, code: 409, message: 'Ya posees este juego activo en tu biblioteca' };
  }

  // 1. Descontar stock vía HTTP en ms-catalogo (:3001)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authorization) headers['Authorization'] = authorization;

  const resStock = await fetch(
    `${MS_CATALOGO_URL}/internal/catalogo/${juegoId}/decrementar-stock`,
    { method: 'POST', headers },
  );

  if (!resStock.ok) {
    const bodyError = (await resStock.json().catch(() => ({}))) as { error?: string };
    return {
      error: true,
      code: resStock.status,
      message: bodyError.error ?? 'No fue posible procesar el stock del juego',
    };
  }

  const dataStock = (await resStock.json()) as { juego?: JuegoCatalogo };
  const precioPagado = dataStock.juego?.precio ?? 0;

  // 2. Crear licencia localmente en data/licencias.json
  const nuevoId =
    licenciasData.meta?.siguiente_id ??
    (licencias.length > 0 ? Math.max(...licencias.map(l => l.id)) + 1 : 1);

  const nuevaLicencia: Licencia = {
    id: nuevoId,
    usuarioSub,
    juegoId,
    precioPagado,
    revocado: false,
    creadaEn: new Date().toISOString()
  };
  
  licencias.push(nuevaLicencia);
  if (licenciasData.meta) {
    licenciasData.meta.siguiente_id = nuevoId + 1;
  }
  guardarLicencias(licenciasData);

  // 3. Emisión asincrónica del evento de dominio en RabbitMQ tras confirmar persistencia
  publicar(ROUTING_KEYS.compraRealizada, {
    licenciaId: nuevaLicencia.id,
    juegoId,
    usuarioSub,
    precioPagado,
    adquiridaEn: nuevaLicencia.creadaEn,
  });

  // 4. Publicar en Kafka (EP3 Entrega 1)
  await publicarEventoKafka({
    tipo: 'compra.realizada',
    juegoId,
    usuarioSub,
    datos: {
      licenciaId: nuevaLicencia.id,
      precioPagado,
      adquiridaEn: nuevaLicencia.creadaEn,
    },
  });

  return { error: false, licencia: nuevaLicencia };
}
