import type { UserRole } from "../../generated/prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  talentId?: string | null;
  sessionId?: string | null;
}

