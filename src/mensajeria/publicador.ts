import { connect, Channel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { EXCHANGES, declararTopologia } from './topologia';

let canal: Channel | undefined;

export async function iniciarMensajeria(): Promise<void> {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('falta RABBITMQ_URL');
  const conexion = await connect(url);
  conexion.on('error', (e: Error) => console.error('[mq] conexion:', e.message));
  canal = await conexion.createChannel();
  canal.on('error', (e: Error) => console.error('[mq] canal:', e.message));
  await declararTopologia(canal);
  console.log(`[mq] publicando en ${url}`);
}

export function publicar(routingKey: string, payload: unknown): void {
  const eventoId = randomUUID();
  try {
    if (!canal) throw new Error('canal no iniciado');
    const ok = canal.publish(EXCHANGES.eventos.nombre, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: 'application/json',
      headers: { 'x-evento-id': eventoId, 'x-emitido-en': new Date().toISOString() },
    });
    console.log(`[mq] publicado ${routingKey} evento ${eventoId} aceptado=${ok}`);
  } catch (e) {
    console.error(`[mq] EVENTO NO PUBLICADO ${routingKey}:`, (e as Error).message);
  }
}
