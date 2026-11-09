import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { UsersService } from "./users.service";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateStaffProfileDto } from "./dto/update-staff-profile.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { QueryUsersDto } from "./dto/query-users.dto";
import {
  PaginatedUsersResponseDto,
  UserDetailResponseDto,
  UserSummaryResponseDto,
} from "./dto/user-response.dto";
import { StaffProfileResponseDto } from "./dto/staff-profile-response.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
  UserRole.super_admin,
];

// ==========================================
// ADMIN USER CONTROLLER (/api/v1/admin/users)
// ==========================================
@ApiTags("Admin - Users & Roles")
@ApiBearerAuth()
@Roles(UserRole.super_admin)
@Controller("admin/users")
export class AdminUsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List users with pagination, filtering and search (Super admin only)" })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedUsersResponseDto })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get detailed user by ID (Super admin only)" })
  @ApiResponse({ status: HttpStatus.OK, type: UserDetailResponseDto })
  findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Post("invite")
  @ApiOperation({ summary: "Invite a new agency staff member (Super admin only)" })
  @ApiResponse({ status: HttpStatus.CREATED, type: UserDetailResponseDto })
  inviteStaff(@Body() input: InviteStaffDto, @CurrentUser() adminUser: AuthenticatedUser) {
    return this.usersService.inviteStaff(input, adminUser);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user role, status or names (Super admin only)" })
  @ApiResponse({ status: HttpStatus.OK, type: UserSummaryResponseDto })
  updateUser(
    @Param("id") id: string,
    @Body() input: UpdateUserDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.usersService.updateUser(id, input, adminUser);
  }

  @Patch(":id/staff-profile")
  @ApiOperation({ summary: "Update agency staff profile details (Super admin only)" })
  @ApiResponse({ status: HttpStatus.OK, type: StaffProfileResponseDto })
  updateStaffProfile(
    @Param("id") id: string,
    @Body() input: UpdateStaffProfileDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.usersService.updateStaffProfile(id, input, adminUser);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft delete a user and revoke sessions (Super admin only)" })
  softDeleteUser(@Param("id") id: string, @CurrentUser() adminUser: AuthenticatedUser) {
    return this.usersService.softDeleteUser(id, adminUser);
  }
}

// ==========================================
// USER SELF-SERVICE CONTROLLER (/api/v1/users)
// ==========================================
@ApiTags("Users - Profile")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get own user profile, roles and scopes" })
  @ApiResponse({ status: HttpStatus.OK, type: UserDetailResponseDto })
  getMe(@CurrentUser("id") userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update own profile information" })
  @ApiResponse({ status: HttpStatus.OK, type: UserSummaryResponseDto })
  updateMe(
    @CurrentUser("id") userId: string,
    @Body() input: UpdateMeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateMe(userId, input, user);
  }

  @Patch("me/staff-profile")
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: "Update own staff profile (WhatsApp, Calendar link, etc.)" })
  @ApiResponse({ status: HttpStatus.OK, type: StaffProfileResponseDto })
  updateMyStaffProfile(
    @CurrentUser("id") userId: string,
    @Body() input: UpdateStaffProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateStaffProfile(userId, input, user);
  }
}
