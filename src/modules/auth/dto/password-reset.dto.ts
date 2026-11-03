import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail({}, { message: "Please enter a valid email address." })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "Single-use password reset token" })
  @IsString()
  token!: string;

  @ApiProperty({ example: "NewSecurePassword123!", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "New password must contain at least 8 characters." })
  newPassword!: string;
}

