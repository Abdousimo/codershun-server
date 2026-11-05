import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { UserRole } from "../../../generated/prisma/client";

export class AuthSessionResponseDto {
  @ApiProperty({ type: String })
  accessToken!: string;

  @ApiProperty({ type: String })
  refreshToken!: string;

  @ApiProperty({ type: Number, example: 900 })
  expiresIn!: number;

  @ApiProperty({
    type: Object,
    example: { id: "uuid", email: "user@example.com", role: "talent" },
  })
  user!: {
    id: string;
    email: string;
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export class Require2faResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  mfaRequired: true = true;

  @ApiProperty({ type: String })
  preAuthToken!: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ type: String })
  secret!: string;

  @ApiProperty({ type: String, description: "Data URI for QR code image" })
  qrCodeUrl!: string;

  @ApiProperty({ type: String, description: "otpauth:// URI for authenticator apps" })
  otpAuthUrl!: string;
}

