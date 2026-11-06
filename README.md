# VidalStore · Microservicio de Licencias, Biblioteca y Productor Kafka (`ms-licencias` · `:3003`)

Este repositorio aloja el microservicio consolidado de **Licencias y Biblioteca/Compras** de la plataforma Cloud Native **VidalStore** (Evaluación Parcial N°3 - Entrega 1, DSY1107). Se ejecuta en el puerto interno `3003` sobre **Node.js 24** y actúa como productor dual hacia **RabbitMQ 4.3** y el clúster **Apache Kafka 3.9 (KRaft)**.

---

## 1. Visión Ejecutiva de la Arquitectura

`ms-licencias` unifica la gestión del ciclo de vida de licencias de videojuegos y las operaciones de compra/consulta de la biblioteca personal de cada jugador. Implementa **Zero-Trust Security** validando criptográficamente cada petición contra AWS Cognito (JWKS) y propaga los hechos de negocio de forma asíncrona hacia las capas de mensajería y streaming:

```mermaid
flowchart TD
    subgraph ENTRADA["Capa de Enlace"]
        BFF["VidalStore-BFF (:3000)"]
    end

    subgraph LICENCIAS["ms-licencias (:3003) - Node 24"]
        AUTH["Middleware JWT<br/>(AWS Cognito JWKS)"]
        MOD_BIB["Módulo Biblioteca y Compras<br/>(/internal/biblioteca, /internal/compras)"]
        MOD_LIC["Módulo Licencias<br/>(/internal/licencias)"]
        DATA[("Persistencia Local<br/>data/licencias.json")]
        PROD_AMQP["Publicador AMQP<br/>(amqplib)"]
        PROD_KAFKA["Productor Kafka<br/>(@platformatic/kafka 2.14.0)"]
    end

    subgraph DOWNSTREAM["Servicios e Infraestructura"]
        CAT["ms-catalogo (:3001)<br/>[Stock y Auditoría]"]
        RMQ["Clúster RabbitMQ 4.3<br/>(Exchange: vidalstore.eventos)"]
        KAFKA["Clúster Kafka KRaft<br/>(Topic: vidalstore.compras)"]
    end

    BFF -->|Bearer JWT| AUTH
    AUTH --> MOD_BIB
    AUTH --> MOD_LIC
    MOD_BIB --> DATA
    MOD_LIC --> DATA

    MOD_BIB -->|POST /decrementar-stock| CAT
    MOD_LIC -->|POST /internal/auditoria| CAT

    MOD_BIB --> PROD_AMQP
    MOD_LIC --> PROD_AMQP
    PROD_AMQP -->|compra.realizada<br/>licencia.revocada| RMQ

    MOD_BIB --> PROD_KAFKA
    PROD_KAFKA -->|acks=all, key=usuarioSub| KAFKA
```

---

## 2. Arquitectura Dual de Mensajería y Streaming (RabbitMQ + Kafka KRaft)

Al confirmarse una transacción de compra o revocación, el servicio mantiene coexistencia estricta entre el bus de eventos AMQP (EP2) y el log particionado de Apache Kafka (EP3):

### 2.1 Productor de Streaming en Apache Kafka (`src/kafka/productor.ts`)
Construido exclusivamente sobre la librería oficial `@platformatic/kafka@2.14.0`:
- **Confirmación de Quórum (`acks: ProduceAcks.ALL`):** Espera confirmación de escritura de todas las réplicas en sincronía (`min.insync.replicas=2`).
- **Idempotencia y Reintentos Acotados:** Configurado con `idempotent: true`, `retries: 10` y `autocreateTopics: false`.
- **Particionamiento Determinista (`compatibilityPartitioner`):** Utiliza `usuarioSub` como `key` del mensaje, garantizando que todas las compras de un mismo jugador se almacenen en la misma partición en orden causal estricto.
- **Serializador Único (`aMensaje`) y Validación DTO:** Antes de emitir, instancia y valida sincrónicamente `SobreEventoDto` mediante `class-validator`, inyectando las tres cabeceras estándar:
  - `x-evento-id`: Identificador único UUIDv4 del evento.
  - `x-correlation-id`: Identificador de correlación de la traza.
  - `content-type`: `application/json`.

### 2.2 Publicador AMQP en RabbitMQ (`src/mensajeria/publicador.ts`)
- Publica mensajes persistentes (`deliveryMode: 2`) en el exchange tipo `topic` `vidalstore.eventos`.
- Emite las routing keys `compra.realizada` y `licencia.revocada` con cabeceras `x-evento-id` y `x-emitido-en`.

---

## 3. Seguridad y Validación Criptográfica (AWS Cognito JWKS)

Ninguna ruta de negocio confía en parámetros de usuario enviados en el cuerpo de la petición:
1. El middleware `exigirToken` (`src/auth/jwt.ts`) exige la cabecera `Authorization: Bearer <token>`.
2. Verifica la firma RS256 contra el conjunto de claves públicas remotas (`${COGNITO_ISSUER}/.well-known/jwks.json`) usando `jose`.
3. Valida los claims `iss`, `token_use === 'access'`, `client_id` y extrae el identificador inmutable `payload.sub` hacia `req.sub`.

---

## 4. Matriz de Endpoints Internos (`:3003`)

| Módulo | Método | Ruta | Descripción Técnica | Autenticación |
| :--- | :---: | :--- | :--- | :---: |
| **Salud** | `GET` | `/salud` | Healthcheck de disponibilidad del contenedor (`{ status: 'ok', servicio: 'vidalstore-licencias' }`). | Pública |
| **Licencias** | `GET` | `/internal/licencias` | Retorna el padrón completo de licencias activas y revocadas. | Bearer JWT |
| **Licencias** | `DELETE` | `/internal/licencias/:licenciaId` | Revoca una licencia activa, registra la acción en `ms-catalogo` (`/internal/auditoria`) y publica `licencia.revocada` en RabbitMQ. | Bearer JWT |
| **Biblioteca** | `GET` | `/internal/biblioteca` | Obtiene las licencias activas del `sub` autenticado y las enriquece consultando los metadatos del juego en `ms-catalogo`. | Bearer JWT |
| **Compras** | `POST` | `/internal/compras` | Valida `ComprarJuegoDto`, descuenta stock en `ms-catalogo`, persiste la licencia, publica en RabbitMQ y emite el evento en `vidalstore.compras` (Kafka). | Bearer JWT |

---

## 5. Estructura del Repositorio

```text
VidalStore-licencias/
├── data/
│   ├── licencias.json                # Almacenamiento local de licencias
│   └── sembrar.ts                    # Script de inicialización de datos semilla
├── src/
│   ├── auth/
│   │   └── jwt.ts                    # Verificación criptográfica JWT contra AWS Cognito JWKS
│   ├── dto/
│   │   └── compra-juego.dto.ts       # DTO de entrada para solicitud de compra
│   ├── interfaces/
│   │   ├── juego-biblioteca.interface.ts
│   │   └── licencia.interface.ts
│   ├── kafka/
│   │   ├── dto/
│   │   │   └── sobre-evento.dto.ts   # DTO de validación del sobre de streaming
│   │   ├── productor.ts              # Cliente @platformatic/kafka, aMensaje y envío
│   │   └── topologia.ts              # Constantes de topics (vidalstore.compras)
│   ├── mensajeria/
│   │   ├── publicador.ts             # Publicador AMQP hacia RabbitMQ
│   │   └── topologia.ts              # Declaración de exchange vidalstore.eventos
│   ├── biblioteca.controller.ts      # Controlador de biblioteca y compras
│   ├── biblioteca.service.ts         # Lógica de compras, stock y emisión dual
│   ├── licencias.controller.ts       # Controlador de consulta y revocación
│   ├── licencias.service.ts          # Lógica de revocación y auditoría HTTP
│   └── main.ts                       # Punto de entrada Express (:3003)
├── Dockerfile                        # Construcción multi-stage sobre node:24-slim
├── package.json                      # Dependencias y scripts
└── tsconfig.json                     # Configuración de compilación TypeScript
```

---

## 6. Variables de Entorno

Crear el archivo `.env` a partir de la siguiente plantilla parametrizada (nunca versionar secretos reales):

```env
PORT=3003
RABBITMQ_URL=amqp://invitado:invitado_dev@localhost:5672
KAFKA_BROKERS=localhost:9092,localhost:9094,localhost:9096
MS_CATALOGO_URL=http://localhost:3001
MS_AUDITORIA_URL=http://localhost:3001/internal/auditoria
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EjemploPool
COGNITO_CLIENT_ID=ejemplo_client_id_cognito
SUB_ADMIN=00000000-0000-0000-0000-000000000001
SUB_EDITOR=00000000-0000-0000-0000-000000000002
SUB_JUGADOR=00000000-0000-0000-0000-000000000003
```

---

## 7. Ejecución y Despliegue

### 7.1 Ejecución Orquestada con Docker Compose (Recomendado)
Desde el repositorio `VidalStore-Plataforma`:
```bash
bash levantar.sh
```

### 7.2 Compilación y Ejecución Individual en Desarrollo
```bash
# 1. Instalar dependencias exactas
npm ci

# 2. Poblar datos iniciales (opcional)
npm run seed

# 3. Compilar TypeScript a JavaScript (dist/)
npm run build

# 4. Iniciar en modo producción
npm start
```

---

## 8. Verificación de Funcionamiento

```bash
# 1. Comprobar estado de salud del servicio
curl -sf http://localhost:3003/salud

# 2. Verificar que una petición sin token es rechazada con 401
curl -i http://localhost:3003/internal/licencias
```
