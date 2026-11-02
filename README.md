# VidalStore - Microservicio de Licencias y Biblioteca (`:3003`)

Microservicio de dominio de **VidalStore** encargado de la gestión del ciclo de vida de licencias, biblioteca personal de jugadores y procesamiento de compras.

## Rutas Internas Expuestas
- `GET /salud`: Estado de salud del servicio.
- `GET /internal/licencias`: Listado completo de licencias (Administración).
- `DELETE /internal/licencias/:licenciaId`: Revocación de una licencia, publicación de `licencia.revocada` y registro síncrono en auditoría.
- `GET /internal/biblioteca`: Listado de juegos activos del usuario autenticado.
- `POST /internal/compras`: Procesamiento de compra de un juego, descuento de stock en catálogo y publicación de `compra.realizada`.
