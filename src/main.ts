import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
const app = express();
app.use(express.json());
app.get('/salud', (_req, res) => {
  res.json({ status: 'ok', servicio: 'vidalstore-licencias' });
});
const PORT = process.env.PORT ?? 3003;
app.listen(PORT, () => {
  console.log(ms-licencias corriendo en http://localhost: + PORT);
});
