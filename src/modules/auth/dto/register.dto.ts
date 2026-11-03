import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { UserRole } from "../../../generated/prisma/client";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail({}, { message: "Please enter a valid email address." })
  email!: string;

  @ApiProperty({ example: "SecurePass123!", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Password must contain at least 8 characters." })
  password!: string;

  @ApiPropertyOptional({ example: "Amina" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: "Benali" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.talent })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.talent;
}
