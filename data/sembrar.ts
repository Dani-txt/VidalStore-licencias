import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import 'dotenv/config';

// SUBs (UUIDs) de los usuarios de prueba en Cognito. 
// Si no estan en el .env, usa UUIDs genericos como fallback.
const SUB_ADMIN = process.env.SUB_ADMIN || "441854d8-5081-7043-5b0d-ba2b784765c4";
const SUB_EDITOR = process.env.SUB_EDITOR || "c47874d8-f091-7066-2b8e-da4e22899f73";
const SUB_JUGADOR = process.env.SUB_JUGADOR || "94182498-00e1-704d-62aa-eee3de8594e5";

const DESTINO_JSON = join(process.cwd(), 'data', 'licencias.json');

interface Licencia {
  id: number;
  usuarioSub: string;
  juegoId: number;
  revocado: boolean;
  creadaEn: string;
}

function sembrarLicencias() {
  console.log("[Sembrador] Inicializando base de datos de licencias de prueba...");

  const fechaPasada = new Date();
  fechaPasada.setDate(fechaPasada.getDate() - 2); // Simula una compra de hace 2 dias

  const licencias: Licencia[] = [
    { id: 1, usuarioSub: SUB_JUGADOR, juegoId: 1, revocado: false, creadaEn: new Date().toISOString() },
    { id: 2, usuarioSub: SUB_JUGADOR, juegoId: 2, revocado: false, creadaEn: new Date().toISOString() },
    { id: 3, usuarioSub: SUB_JUGADOR, juegoId: 3, revocado: true,  creadaEn: fechaPasada.toISOString() }, // Revocada
    { id: 4, usuarioSub: SUB_EDITOR,  juegoId: 4, revocado: false, creadaEn: new Date().toISOString() },
    { id: 5, usuarioSub: SUB_ADMIN,   juegoId: 5, revocado: false, creadaEn: new Date().toISOString() }
  ];

  const dataFinal = {
    meta: { 
      siguiente_id: 6,
      generadoEn: new Date().toISOString()
    },
    licencias: licencias
  };

  try {
    writeFileSync(DESTINO_JSON, JSON.stringify(dataFinal, null, 2), 'utf-8');
    console.log(`[Sembrador] Exito. ${licencias.length} licencias de prueba creadas en data/licencias.json`);
  } catch (error) {
    console.error("[Error] Fallo al escribir el archivo JSON en disco:", error);
  }
}

sembrarLicencias();
