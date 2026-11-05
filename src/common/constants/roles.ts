import { UserRole } from "../../generated/prisma/client";

export const STAFF_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.finance,
  UserRole.sales,
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.account_manager,
];

export const FINANCE_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.finance,
];

export const RECRUITER_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.recruiter_lead,
  UserRole.recruiter,
];

export const SALES_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.sales,
  UserRole.account_manager,
];

