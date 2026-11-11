import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export class UpdateClientWorkspaceDto {
  @ApiPropertyOptional({ example: "Acme Corp" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Acme Corporation SAS" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: "FR123456789" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: "FR123456789" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ example: "billing@acme.com" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional({ example: "123 Business Street, Paris" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ example: "https://acme.com" })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: "+33123456789" })
  @Transform(emptyToUndefined)
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

