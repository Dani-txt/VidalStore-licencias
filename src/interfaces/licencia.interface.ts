export interface Licencia {
  id: number;
  usuarioSub: string;
  juegoId: number;
  precioPagado?: number;
  revocado: boolean;
  creadaEn: string;
}

export interface LicenciasData {
  meta?: {
    siguiente_id: number;
    generadoEn?: string;
  };
  licencias: Licencia[];
}
