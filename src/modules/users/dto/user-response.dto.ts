import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UiLanguage, UserRole, UserStatus } from "../../../generated/prisma/client";
import { StaffProfileResponseDto } from "./staff-profile-response.dto";

export class UserSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty({ enum: UiLanguage })
  language!: UiLanguage;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  twoFactorEnabled!: boolean;

  @ApiPropertyOptional()
  lastLoginAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class UserDetailResponseDto extends UserSummaryResponseDto {
  @ApiPropertyOptional({ type: StaffProfileResponseDto })
  staffProfile?: StaffProfileResponseDto | null;

  @ApiPropertyOptional()
  companyId?: string | null;

  @ApiPropertyOptional()
  talentId?: string | null;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserSummaryResponseDto] })
  data!: UserSummaryResponseDto[];

  @ApiProperty({
    example: { page: 1, pageSize: 25, total: 42, totalPages: 2 },
  })
  meta!: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

