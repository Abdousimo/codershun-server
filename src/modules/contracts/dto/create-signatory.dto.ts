import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateSignatoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  party!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  signingOrder?: number;
}
