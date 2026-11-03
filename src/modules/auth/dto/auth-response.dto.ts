import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { UserRole } from "../../../generated/prisma/client";

export class AuthSessionResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({
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
  @ApiProperty({ example: true })
  mfaRequired: true = true;

  @ApiProperty()
  preAuthToken!: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty()
  secret!: string;

  @ApiProperty({ description: "Data URI for QR code image" })
  qrCodeUrl!: string;

  @ApiProperty({ description: "otpauth:// URI for authenticator apps" })
  otpAuthUrl!: string;
}

