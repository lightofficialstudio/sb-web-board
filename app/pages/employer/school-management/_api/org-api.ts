// ─── API layer สำหรับ Organization / RBAC ────────────────────────────────────

import axios from "axios";

const BASE = "/api/v1/employer/organization";

// ✨ helper สำหรับเรียก API ทุก endpoint
async function request<T>(
  url: string,
  options: Parameters<typeof axios.request>[0] = {},
): Promise<T> {
  const res = await axios.request<{
    status_code: number;
    message_th: string;
    message_en: string;
    data: T;
  }>({
    url,
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.data.data;
}

// ✨ สร้าง query string พร้อม school_profile_id เมื่อมี delegated context
const withDelegated = (base: string, delegatedOrgId?: string | null) =>
  delegatedOrgId ? `${base}&school_profile_id=${delegatedOrgId}` : base;

// ─── Members ─────────────────────────────────────────────────────────────────

export const fetchOrgMembers = (
  userId: string,
  delegatedOrgId?: string | null,
) =>
  request(withDelegated(`${BASE}/members?user_id=${userId}`, delegatedOrgId));

export const fetchUpdateMemberRole = (
  userId: string,
  body: { member_id: string; role_id: string },
  delegatedOrgId?: string | null,
) =>
  request(withDelegated(`${BASE}/members?user_id=${userId}`, delegatedOrgId), {
    method: "PATCH",
    data: body,
  });

export const fetchRemoveMember = (
  userId: string,
  memberId: string,
  delegatedOrgId?: string | null,
) =>
  request(
    withDelegated(
      `${BASE}/members?user_id=${userId}&member_id=${memberId}`,
      delegatedOrgId,
    ),
    {
      method: "DELETE",
    },
  );

// ─── Invites ─────────────────────────────────────────────────────────────────

export const fetchPendingInvites = (
  userId: string,
  delegatedOrgId?: string | null,
) =>
  request(withDelegated(`${BASE}/invites?user_id=${userId}`, delegatedOrgId));

// ✨ ส่งคำเชิญ + ส่งอีเมลจริง
export const fetchSendInvite = (
  userId: string,
  body: { email: string; role_id: string },
  delegatedOrgId?: string | null,
) =>
  request(withDelegated(`${BASE}/invites?user_id=${userId}`, delegatedOrgId), {
    method: "POST",
    data: body,
  });

export const fetchRevokeInvite = (
  userId: string,
  inviteId: string,
  delegatedOrgId?: string | null,
) =>
  request(
    withDelegated(
      `${BASE}/invites?user_id=${userId}&invite_id=${inviteId}`,
      delegatedOrgId,
    ),
    {
      method: "DELETE",
    },
  );

export const fetchAcceptInvite = (userId: string, token: string) =>
  request(`${BASE}/invites/accept?user_id=${userId}`, {
    method: "POST",
    data: { token },
  });

// ─── Roles ────────────────────────────────────────────────────────────────────

export const fetchOrgRoles = (userId: string, delegatedOrgId?: string | null) =>
  request(withDelegated(`${BASE}/roles?user_id=${userId}`, delegatedOrgId));

export const fetchCreateRole = (
  userId: string,
  body: {
    name: string;
    description?: string;
    color?: string;
    icon_key?: string;
  },
  delegatedOrgId?: string | null,
) =>
  request(withDelegated(`${BASE}/roles?user_id=${userId}`, delegatedOrgId), {
    method: "POST",
    data: body,
  });

export const fetchUpdateRole = (
  userId: string,
  roleId: string,
  body: {
    name?: string;
    description?: string;
    color?: string;
    icon_key?: string;
  },
  delegatedOrgId?: string | null,
) =>
  request(
    withDelegated(
      `${BASE}/roles?user_id=${userId}&role_id=${roleId}`,
      delegatedOrgId,
    ),
    {
      method: "PATCH",
      data: body,
    },
  );

export const fetchDeleteRole = (
  userId: string,
  roleId: string,
  delegatedOrgId?: string | null,
) =>
  request(
    withDelegated(
      `${BASE}/roles?user_id=${userId}&role_id=${roleId}`,
      delegatedOrgId,
    ),
    {
      method: "DELETE",
    },
  );

export const fetchUpdateRolePermissions = (
  userId: string,
  roleId: string,
  permissions: string[],
  delegatedOrgId?: string | null,
) =>
  request(
    withDelegated(
      `${BASE}/roles/permissions?user_id=${userId}&role_id=${roleId}`,
      delegatedOrgId,
    ),
    {
      method: "PUT",
      data: { permissions },
    },
  );

// ─── Delegated Access ────────────────────────────────────────────────────────

export const fetchDelegatedAccess = (userId: string) =>
  request(`${BASE}/delegated?user_id=${userId}`);
