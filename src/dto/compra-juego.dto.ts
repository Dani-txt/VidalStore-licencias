import { IsInt, IsPositive, IsNotEmpty } from 'class-validator';

export class ComprarJuegoDto {
  @IsNotEmpty({ message: 'El campo juegoId es obligatorio' })
  @IsInt({ message: 'El juegoId debe ser un número entero' })
  @IsPositive({ message: 'El juegoId debe ser positivo' })
  juegoId!: number;
}
