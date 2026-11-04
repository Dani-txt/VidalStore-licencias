import { IsUUID, IsString, IsNotEmpty, IsInt, IsISO8601, IsObject } from 'class-validator';

export class SobreEventoDto {
  @IsUUID()
  eventoId!: string;

  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @IsInt()
  version!: number;

  @IsISO8601()
  emitidoEn!: string;

  @IsNotEmpty()
  juegoId!: string | number;

  @IsString()
  @IsNotEmpty()
  usuarioSub!: string;

  @IsObject()
  datos!: Record<string, any>;
}
