import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const EMISOR = process.env.COGNITO_ISSUER;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
if (!EMISOR || !CLIENT_ID) throw new Error('faltan COGNITO_ISSUER o COGNITO_CLIENT_ID');
const jwks = createRemoteJWKSet(new URL(`${EMISOR}/.well-known/jwks.json`));

export interface RequestAutenticada extends Request { sub: string }

export async function exigirToken(req: Request, res: Response, next: NextFunction) {
  const cab = req.headers.authorization;
  if (!cab?.startsWith('Bearer ')) return res.status(401).json({ error: 'falta un token valido' });
  try {
    const { payload } = await jwtVerify(cab.slice(7), jwks, { issuer: EMISOR });
    if (payload.token_use !== 'access' || payload.client_id !== CLIENT_ID || !payload.sub) {
      throw new Error('claims invalidos');
    }
    (req as RequestAutenticada).sub = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'falta un token valido' });
  }
}
