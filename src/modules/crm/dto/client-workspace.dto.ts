import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateClientWorkspaceDto {
  @ApiPropertyOptional({ example: "Acme Corp" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Acme Corporation SAS" })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: "FR123456789" })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: "FR123456789" })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ example: "billing@acme.com" })
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional({ example: "123 Business Street, Paris" })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ example: "https://acme.com" })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: "+33123456789" })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class InviteClientWorkspaceMemberDto {
  @ApiProperty({ example: "colleague@acme.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: "Jane" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  canViewInvoices?: boolean;
}
