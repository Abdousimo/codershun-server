import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com", description: "Email address of the account" })
  @IsEmail({}, { message: "Please enter a valid email address." })
  email!: string;
}

export class VerifyResetCodeDto {
  @ApiProperty({ example: "123456", description: "6-digit OTP code or reset token" })
  @IsString()
  code!: string;

  @ApiProperty({ example: "user@example.com", required: false, description: "Optional email associated with OTP" })
  @IsOptional()
  @IsEmail({}, { message: "Please enter a valid email address." })
  email?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: "123456", description: "Single-use password reset OTP code or token", required: false })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({ example: "123456", description: "6-digit password reset OTP code", required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: "123456", description: "6-digit password reset OTP code", required: false })
  @IsOptional()
  @IsString()
  otp?: string;

  @ApiProperty({ example: "user@example.com", required: false })
  @IsOptional()
  @IsEmail({}, { message: "Please enter a valid email address." })
  email?: string;

  @ApiProperty({ example: "NewSecurePassword123!", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "New password must contain at least 8 characters." })
  newPassword!: string;
}
