import { create } from "zustand";
import {
  fetchCreateRole,
  fetchDeleteRole,
  fetchOrgMembers,
  fetchOrgRoles,
  fetchPendingInvites,
  fetchRemoveMember,
  fetchRevokeInvite,
  fetchSendInvite,
  fetchUpdateMemberRole,
  fetchUpdateRole,
  fetchUpdateRolePermissions,
} from "../_api/org-api";

// ─── Types (DB-aligned) ───────────────────────────────────────────────────────

export interface OrgPermission {
  id: string;
  roleId: string;
  permissionKey: string;
}

export interface OrgRole {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  iconKey: string;
  isSystem: boolean;
  permissions: OrgPermission[];
  _count: { members: number };
  createdAt: string;
}

export interface OrgMemberProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImageUrl: string | null;
}

export interface OrgMember {
  id: string;
  orgId: string;
  profileId: string;
  roleId: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  invitedBy: string | null;
  joinedAt: string | null;
  createdAt: string;
  profile: OrgMemberProfile;
  role: OrgRole;
}

export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  roleId: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
  inviter: { firstName: string | null; lastName: string | null };
}

// ─── Store State ──────────────────────────────────────────────────────────────

interface OrgState {
  members: OrgMember[];
  invites: OrgInvite[];
  roles: OrgRole[];
  isLoadingMembers: boolean;
  isLoadingInvites: boolean;
  isLoadingRoles: boolean;

  // Members
  fetchMembers: (
    userId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;
  inviteMember: (
    userId: string,
    email: string,
    roleId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;
  updateMemberRole: (
    userId: string,
    memberId: string,
    roleId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;
  removeMember: (
    userId: string,
    memberId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;

  // Invites
  fetchInvites: (
    userId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;
  revokeInvite: (
    userId: string,
    inviteId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;

  // Roles
  fetchRoles: (userId: string, delegatedOrgId?: string | null) => Promise<void>;
  createRole: (
    userId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      icon_key?: string;
    },
    delegatedOrgId?: string | null,
  ) => Promise<OrgRole>;
  updateRole: (
    userId: string,
    roleId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon_key?: string;
    },
    delegatedOrgId?: string | null,
  ) => Promise<void>;
  deleteRole: (
    userId: string,
    roleId: string,
    delegatedOrgId?: string | null,
  ) => Promise<void>;
  savePermissions: (
    userId: string,
    roleId: string,
    permissions: string[],
    delegatedOrgId?: string | null,
  ) => Promise<void>;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  members: [],
  invites: [],
  roles: [],
  isLoadingMembers: false,
  isLoadingInvites: false,
  isLoadingRoles: false,

  // ─── Members ────────────────────────────────────────────────────────────────

  fetchMembers: async (userId, delegatedOrgId) => {
    set({ isLoadingMembers: true });
    try {
      const data = await fetchOrgMembers(userId, delegatedOrgId);
      set({ members: Array.isArray(data) ? (data as OrgMember[]) : [] });
    } catch (err) {
      console.error("❌ [org-store] fetchMembers:", err);
      set({ members: [] });
    } finally {
      set({ isLoadingMembers: false });
    }
  },

  inviteMember: async (userId, email, roleId, delegatedOrgId) => {
    // ✨ เรียก POST /invites ซึ่งจะสร้าง invite + ส่ง email จริง
    await fetchSendInvite(userId, { email, role_id: roleId }, delegatedOrgId);
    await get().fetchInvites(userId, delegatedOrgId);
  },

  updateMemberRole: async (userId, memberId, roleId, delegatedOrgId) => {
    await fetchUpdateMemberRole(
      userId,
      { member_id: memberId, role_id: roleId },
      delegatedOrgId,
    );
    // optimistic: update local state
    set((state) => ({
      members: state.members.map((m) => {
        if (m.id !== memberId) return m;
        const newRole = state.roles.find((r) => r.id === roleId);
        return newRole ? { ...m, roleId, role: newRole } : m;
      }),
    }));
  },

  removeMember: async (userId, memberId, delegatedOrgId) => {
    await fetchRemoveMember(userId, memberId, delegatedOrgId);
    set((state) => ({
      members: state.members.filter((m) => m.id !== memberId),
    }));
  },

  // ─── Invites ────────────────────────────────────────────────────────────────

  fetchInvites: async (userId, delegatedOrgId) => {
    set({ isLoadingInvites: true });
    try {
      const data = await fetchPendingInvites(userId, delegatedOrgId);
      set({ invites: Array.isArray(data) ? (data as OrgInvite[]) : [] });
    } catch (err) {
      console.error("❌ [org-store] fetchInvites:", err);
      set({ invites: [] });
    } finally {
      set({ isLoadingInvites: false });
    }
  },

  revokeInvite: async (userId, inviteId, delegatedOrgId) => {
    await fetchRevokeInvite(userId, inviteId, delegatedOrgId);
    set((state) => ({
      invites: state.invites.filter((i) => i.id !== inviteId),
    }));
  },

  // ─── Roles ──────────────────────────────────────────────────────────────────

  fetchRoles: async (userId, delegatedOrgId) => {
    set({ isLoadingRoles: true });
    try {
      const data = await fetchOrgRoles(userId, delegatedOrgId);
      set({ roles: Array.isArray(data) ? (data as OrgRole[]) : [] });
    } catch (err) {
      console.error("❌ [org-store] fetchRoles:", err);
      set({ roles: [] });
    } finally {
      set({ isLoadingRoles: false });
    }
  },

  createRole: async (userId, data, delegatedOrgId) => {
    const newRole = (await fetchCreateRole(
      userId,
      data,
      delegatedOrgId,
    )) as OrgRole;
    set((state) => ({ roles: [...state.roles, newRole] }));
    return newRole;
  },

  updateRole: async (userId, roleId, data, delegatedOrgId) => {
    const updated = (await fetchUpdateRole(
      userId,
      roleId,
      data,
      delegatedOrgId,
    )) as OrgRole;
    set((state) => ({
      roles: state.roles.map((r) => (r.id === roleId ? updated : r)),
    }));
  },

  deleteRole: async (userId, roleId, delegatedOrgId) => {
    await fetchDeleteRole(userId, roleId, delegatedOrgId);
    set((state) => ({ roles: state.roles.filter((r) => r.id !== roleId) }));
  },

  savePermissions: async (userId, roleId, permissions, delegatedOrgId) => {
    const updated = (await fetchUpdateRolePermissions(
      userId,
      roleId,
      permissions,
      delegatedOrgId,
    )) as OrgRole;
    set((state) => ({
      roles: state.roles.map((r) => (r.id === roleId ? updated : r)),
    }));
  },
}));
