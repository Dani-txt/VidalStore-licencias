import { Router, Request, Response } from 'express';
import * as service from './biblioteca.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ComprarJuegoDto } from './dto/compra-juego.dto';
import { RequestAutenticada } from './auth/jwt';

export const router = Router();

router.get('/biblioteca', async (req: Request, res: Response) => {
  try {
    const usuarioSub = (req as RequestAutenticada).sub;
    const biblioteca = await service.listarBiblioteca(usuarioSub, req.headers.authorization as string);
    res.json(biblioteca);
  } catch (error) {
    res.status(500).json({ error: 'Error interno al obtener la biblioteca' });
  }
});

router.post('/compras', async (req: Request, res: Response) => {
  const usuarioSub = (req as RequestAutenticada).sub;

  const dtoObj = plainToInstance(ComprarJuegoDto, req.body) as ComprarJuegoDto;
  const errores = await validate(dtoObj);
  
  if (errores.length > 0) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: errores.map(e => e.constraints)
    });
  }

  try {
    const resultado = await service.procesarCompra(
      usuarioSub,
      dtoObj.juegoId,
      req.headers.authorization as string,
    );
    
    if (resultado.error) {
      return res.status(resultado.code!).json({ error: resultado.message });
    }

    res.status(201).json({ 
      mensaje: 'Compra realizada con éxito', 
      licencia: resultado.licencia 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al procesar la compra' });
  }
});
