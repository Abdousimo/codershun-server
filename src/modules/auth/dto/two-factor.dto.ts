import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class VerifyEmailDto {
  @ApiProperty({ description: "Single-use email verification token" })
  @IsString()
  token!: string;
}

export class Enable2faDto {
  @ApiProperty({ example: "123456", description: "6-digit verification code from authenticator app" })
  @IsString()
  @Length(6, 6, { message: "TOTP code must be 6 digits." })
  code!: string;
}

