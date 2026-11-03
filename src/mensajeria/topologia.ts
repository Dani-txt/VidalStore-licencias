import { Channel } from 'amqplib';

export const EXCHANGES = {
  eventos: { nombre: 'vidalstore.eventos', tipo: 'topic' },
} as const;

export const ROUTING_KEYS = {
  compraRealizada: 'compra.realizada',
  licenciaRevocada: 'licencia.revocada',
  juegoPublicado: 'juego.publicado',
} as const;

export async function declararTopologia(canal: Channel): Promise<void> {
  await canal.assertExchange(EXCHANGES.eventos.nombre, EXCHANGES.eventos.tipo, { durable: true });
}
