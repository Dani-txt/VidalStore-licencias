import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { router as licenciasRouter } from './licencias.controller';
import { router as bibliotecaRouter } from './biblioteca.controller';
import { exigirToken } from './auth/jwt';
import { iniciarMensajeria } from './mensajeria/publicador';

const app = express();
app.use(express.json());

app.get('/salud', (_req, res) => {
  res.json({ status: 'ok', servicio: 'vidalstore-licencias' });
});

app.use('/internal/licencias', exigirToken, licenciasRouter);
app.use('/internal', exigirToken, bibliotecaRouter);

const PORT = process.env.PORT ?? 3003;

iniciarMensajeria()
  .then(() =>
    app.listen(PORT, () =>
      console.log(`ms-licencias (+biblioteca) corriendo en http://localhost:${PORT}`),
    ),
  )
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  });
