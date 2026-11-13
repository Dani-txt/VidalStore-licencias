import {
  Producer,
  ProduceAcks,
  compatibilityPartitioner,
  stringSerializers,
} from '@platformatic/kafka';
import { TOPICS } from './topologia';
import { SobreEventoDto } from './dto/sobre-evento.dto';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'node:crypto';

const kafkaBrokers = process.env.KAFKA_BROKERS;
if (!kafkaBrokers) {
  throw new Error('Variable de entorno KAFKA_BROKERS no configurada');
}
const brokers = kafkaBrokers.split(',');

export const productor = new Producer({
  clientId: 'vidalstore-licencias',
  bootstrapBrokers: brokers,
  serializers: stringSerializers,
  idempotent: true,
  acks: ProduceAcks.ALL,
  retries: 10,
  partitioner: compatibilityPartitioner,
  autocreateTopics: false,
});

export interface EventoCompraKafka {
  tipo: string;
  juegoId: string | number;
  usuarioSub: string;
  datos: Record<string, any>;
  correlationId?: string;
}

export function aMensaje(evento: EventoCompraKafka) {
  const eventoId = randomUUID();
  const correlationId = evento.correlationId || randomUUID();
  const emitidoEn = new Date().toISOString();

  const sobre = plainToInstance(SobreEventoDto, {
    eventoId,
    tipo: evento.tipo,
    version: 1,
    emitidoEn,
    juegoId: String(evento.juegoId),
    usuarioSub: evento.usuarioSub,
    datos: evento.datos,
  });

  const errores = validateSync(sobre);
  if (errores.length > 0) {
    throw new Error(
      `Evento Kafka inválido: ${errores.map((e) => Object.values(e.constraints || {})).join(', ')}`,
    );
  }

  return {
    topic: TOPICS.compras,
    key: sobre.usuarioSub,
    value: JSON.stringify(sobre),
    headers: {
      'x-evento-id': sobre.eventoId,
      'x-correlation-id': correlationId,
      'content-type': 'application/json',
    },
  };
}

export async function publicarEventoKafka(evento: EventoCompraKafka): Promise<void> {
  try {
    await productor.send({ messages: [aMensaje(evento)] });
    console.log(`[kafka] publicado evento ${evento.tipo} para usuario ${evento.usuarioSub} en ${TOPICS.compras}`);
  } catch (err) {
    console.error(`[kafka] error al publicar evento en Kafka:`, (err as Error).message);
  }
}
