import type { Request } from "express";
import type { AuthenticatedUser } from "./authenticated-user";

export type { AuthenticatedUser };

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
