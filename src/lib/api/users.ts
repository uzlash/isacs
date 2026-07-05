// ====================================================================
// User management + TOTP onboarding-token API calls.
// (See ISACS_API_Reference "Users" and auth_api_reference
//  "GET /auth/mfa/onboarding-token".)
// ====================================================================

import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

export interface ApiUserFull {
  id: string;
  email: string;
  role: Role;
  staffId: string | null;
  assignedNodeIds?: string[] | null;
  isActive: boolean;
  mfaEnabled?: boolean;
  tokenVersion?: number;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  staffId?: string;
  /** Access nodes to assign — only accepted when role is security_personnel;
   *  all IDs are validated to exist server-side (400 otherwise). */
  assignedNodeIds?: string[];
}

export interface UpdateUserInput {
  email?: string;
  role?: Role;
  staffId?: string | null;
  /** Replace the assigned node set (security_personnel only). Pass null to
   *  clear all assignments; an array is a full replace, not a merge. */
  assignedNodeIds?: string[] | null;
}

export async function createUser(body: CreateUserInput): Promise<ApiUserFull> {
  const { data } = await api.post<ApiUserFull>("/users", body);
  return data;
}

export async function updateUser(id: string, body: UpdateUserInput): Promise<ApiUserFull> {
  const { data } = await api.put<ApiUserFull>(`/users/${id}`, body);
  return data;
}

export async function deactivateUser(id: string): Promise<ApiUserFull> {
  const { data } = await api.patch<ApiUserFull>(`/users/${id}/deactivate`);
  return data;
}

export async function activateUser(id: string): Promise<ApiUserFull> {
  const { data } = await api.patch<ApiUserFull>(`/users/${id}/activate`);
  return data;
}

/** Admin reset of another account needs no currentPassword (super_admin). */
export async function resetUserPassword(
  id: string,
  newPassword: string,
  currentPassword?: string
): Promise<void> {
  await api.post(`/users/${id}/reset-password`, {
    newPassword,
    ...(currentPassword ? { currentPassword } : {}),
  });
}

// ---- TOTP onboarding token (custom authenticator app) ----
export interface OnboardingToken {
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * Generate the encrypted TOTP onboarding token for a user (admin only).
 * Requires the target user to have a pending MFA secret (i.e. mid-enrollment);
 * otherwise the API returns 400 "No pending MFA setup".
 */
export async function getOnboardingToken(userId: string): Promise<OnboardingToken> {
  const { data } = await api.get<{ token: OnboardingToken }>(
    `/auth/mfa/onboarding-token?userId=${encodeURIComponent(userId)}`
  );
  return data.token;
}

/**
 * Provision TOTP for a user who has no pending secret yet: server-side runs
 * login → mfa/setup → onboarding-token using the user's password (which the
 * admin set at creation). Returns the encrypted onboarding token.
 */
export async function provisionOnboarding(
  email: string,
  password: string,
  userId: string
): Promise<OnboardingToken> {
  const { data } = await api.post<{ token: OnboardingToken }>("/users/provision-mfa", {
    email,
    password,
    userId,
  });
  return data.token;
}
