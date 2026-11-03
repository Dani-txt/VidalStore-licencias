import { Router, Request, Response } from 'express';
import * as service from './licencias.service';
import { RequestAutenticada } from './auth/jwt';

export const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const licencias = service.listarTodas();
  res.json({ licencias });
});

router.delete('/:licenciaId', async (req: Request, res: Response) => {
  const adminSub = (req as RequestAutenticada).sub;
  const licenciaId = parseInt(req.params.licenciaId, 10);
  if (Number.isNaN(licenciaId)) return res.status(400).json({ error: 'licenciaId invalido' });
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.slice(0, 200) : '';

  const licencia = await service.revocar(licenciaId, adminSub, motivo, req.headers.authorization as string);
  if (!licencia) return res.status(404).json({ mensaje: `Licencia ${licenciaId} no encontrada o ya revocada` });
  res.json({ mensaje: 'Licencia revocada', licencia });
});
