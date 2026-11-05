import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UiLanguage, UserRole, UserStatus } from "../../../generated/prisma/client";
import { StaffProfileResponseDto } from "./staff-profile-response.dto";

export class UserSummaryResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional({ type: String })
  firstName?: string | null;

  @ApiPropertyOptional({ type: String })
  lastName?: string | null;

  @ApiPropertyOptional({ type: String })
  phone?: string | null;

  @ApiProperty({ enum: UiLanguage })
  language!: UiLanguage;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: Boolean })
  twoFactorEnabled!: boolean;

  @ApiPropertyOptional({ type: Date })
  lastLoginAt?: Date | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;
}

export class UserDetailResponseDto extends UserSummaryResponseDto {
  @ApiPropertyOptional({ type: () => StaffProfileResponseDto })
  staffProfile?: StaffProfileResponseDto | null;

  @ApiPropertyOptional({ type: String })
  companyId?: string | null;

  @ApiPropertyOptional({ type: String })
  talentId?: string | null;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: () => [UserSummaryResponseDto] })
  data!: UserSummaryResponseDto[];

  @ApiProperty({
    type: Object,
    example: { page: 1, pageSize: 25, total: 42, totalPages: 2 },
  })
  meta!: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

