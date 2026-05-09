import { prisma } from "@/lib/prisma";
import { OrgMemberStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  CreateRoleInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  UpdatePermissionsInput,
  UpdateRoleInput,
} from "../validation/org-schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ✨ ค้นหา schoolProfileId + ตรวจสอบว่า user เป็น OWNER หรือ ADMIN ขององค์กร
const getOrgId = async (userId: string): Promise<string> => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolProfile: { select: { id: true } } },
  });
  if (!profile?.schoolProfile) throw new Error("SCHOOL_PROFILE_NOT_FOUND");
  return profile.schoolProfile.id;
};

// ✨ ค้นหา profileId จาก userId
const getProfileId = async (userId: string): Promise<string> => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  return profile.id;
};

// ✨ resolveOrgId — รองรับ Delegated Context
// ถ้า delegatedOrgId ระบุมา ให้ตรวจสอบว่า userId มีสิทธิ์ในองค์กรนั้นจริง แล้วใช้ค่านั้น
export const resolveOrgId = async (
  userId: string,
  requiredPermission: string,
  delegatedOrgId?: string | null,
): Promise<string> => {
  if (!delegatedOrgId) return getOrgId(userId);

  const profileId = await getProfileId(userId);

  const member = await prisma.orgMember.findFirst({
    where: {
      profileId,
      orgId: delegatedOrgId,
      status: "ACTIVE",
      role: { permissions: { some: { permissionKey: requiredPermission } } },
    },
    select: { id: true },
  });

  if (!member) throw new Error("DELEGATED_PERMISSION_DENIED");
  return delegatedOrgId;
};

// ─── System Roles Seed ───────────────────────────────────────────────────────

const SYSTEM_ROLES = [
  {
    slug: "owner",
    name: "Owner",
    description: "เจ้าขององค์กร — มีสิทธิ์ทุกอย่าง",
    color: "#F59E0B",
    iconKey: "crown",
    isSystem: true,
    permissions: [
      "jobs:view",
      "jobs:create",
      "jobs:edit",
      "jobs:delete",
      "jobs:export",
      "jobs:manage",
      "applicants:view",
      "applicants:create",
      "applicants:edit",
      "applicants:delete",
      "applicants:export",
      "applicants:manage",
      "profile:view",
      "profile:create",
      "profile:edit",
      "profile:delete",
      "profile:export",
      "profile:manage",
      "members:view",
      "members:create",
      "members:edit",
      "members:delete",
      "members:export",
      "members:manage",
      "analytics:view",
      "analytics:export",
      "settings:view",
      "settings:edit",
      "settings:manage",
    ],
  },
  {
    slug: "admin",
    name: "Admin",
    description: "ผู้ดูแลระบบ — จัดการงานและผู้สมัครได้",
    color: "#3B82F6",
    iconKey: "safety",
    isSystem: true,
    permissions: [
      "jobs:view",
      "jobs:create",
      "jobs:edit",
      "jobs:delete",
      "applicants:view",
      "applicants:edit",
      "applicants:export",
      "analytics:view",
      "profile:view",
      "profile:edit",
    ],
  },
  {
    slug: "staff",
    name: "Staff",
    description: "เจ้าหน้าที่ทั่วไป — ดูข้อมูลได้อย่างเดียว",
    color: "#94A3B8",
    iconKey: "user",
    isSystem: true,
    permissions: ["jobs:view", "applicants:view", "analytics:view"],
  },
];

// ✨ สร้าง system roles ให้องค์กรถ้ายังไม่มี (ใช้ upsert เพื่อป้องกัน race condition)
export const ensureSystemRolesService = async (orgId: string) => {
  for (const sr of SYSTEM_ROLES) {
    await prisma.orgRole.upsert({
      where: { unique_org_role_slug: { orgId, slug: sr.slug } },
      update: {},
      create: {
        orgId,
        name: sr.name,
        slug: sr.slug,
        description: sr.description,
        color: sr.color,
        iconKey: sr.iconKey,
        isSystem: sr.isSystem,
        permissions: {
          create: sr.permissions.map((key) => ({ permissionKey: key })),
        },
      },
    });
  }
};

// ─── Org Members ─────────────────────────────────────────────────────────────

// ✨ ดึงสมาชิกทั้งหมดขององค์กร
export const getOrgMembersService = async (userId: string, delegatedOrgId?: string | null) => {
  const orgId = await resolveOrgId(userId, "members:view", delegatedOrgId);
  await ensureSystemRolesService(orgId);

  return await prisma.orgMember.findMany({
    where: { orgId },
    include: {
      profile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImageUrl: true,
        },
      },
      role: {
        include: { permissions: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

// ✨ ดึงคำเชิญที่รอการตอบรับ
export const getPendingInvitesService = async (userId: string, delegatedOrgId?: string | null) => {
  const orgId = await resolveOrgId(userId, "members:view", delegatedOrgId);

  return await prisma.orgInvite.findMany({
    where: { orgId, status: "PENDING" },
    include: {
      inviter: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ✨ เชิญสมาชิกใหม่
export const inviteMemberService = async (
  userId: string,
  input: InviteMemberInput,
  delegatedOrgId?: string | null,
) => {
  const orgId = await resolveOrgId(userId, "members:create", delegatedOrgId);
  const inviterProfileId = await getProfileId(userId);

  // ตรวจสอบว่า role อยู่ในองค์กรนี้
  const role = await prisma.orgRole.findFirst({
    where: { id: input.role_id, orgId },
  });
  if (!role) throw new Error("ROLE_NOT_FOUND");

  // ตรวจสอบว่าอีเมลนี้เป็นสมาชิกแล้วหรือเปล่า
  const existingMember = await prisma.orgMember.findFirst({
    where: {
      orgId,
      profile: { email: input.email },
    },
  });
  if (existingMember) throw new Error("ALREADY_MEMBER");

  // ยกเลิก pending invite เก่า (ถ้ามี)
  await prisma.orgInvite.updateMany({
    where: { orgId, email: input.email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = randomUUID();

  return await prisma.orgInvite.create({
    data: {
      orgId,
      email: input.email,
      roleId: input.role_id,
      token,
      status: "PENDING",
      invitedBy: inviterProfileId,
      expiresAt,
    },
    include: {
      inviter: { select: { firstName: true, lastName: true } },
    },
  });
};

// ✨ ยกเลิกคำเชิญ
export const revokeInviteService = async (userId: string, inviteId: string, delegatedOrgId?: string | null) => {
  const orgId = await resolveOrgId(userId, "members:edit", delegatedOrgId);

  const invite = await prisma.orgInvite.findFirst({
    where: { id: inviteId, orgId },
  });
  if (!invite) throw new Error("INVITE_NOT_FOUND");

  return await prisma.orgInvite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });
};

// ✨ ลบสมาชิกออกจากองค์กร
export const removeMemberService = async (userId: string, memberId: string, delegatedOrgId?: string | null) => {
  const orgId = await resolveOrgId(userId, "members:delete", delegatedOrgId);

  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, orgId },
    include: { role: true },
  });
  if (!member) throw new Error("MEMBER_NOT_FOUND");
  if (member.role.slug === "owner") throw new Error("CANNOT_REMOVE_OWNER");

  return await prisma.orgMember.delete({ where: { id: memberId } });
};

// ✨ อัปเดต Role ของสมาชิก
export const updateMemberRoleService = async (
  userId: string,
  input: UpdateMemberRoleInput,
  delegatedOrgId?: string | null,
) => {
  const orgId = await resolveOrgId(userId, "members:edit", delegatedOrgId);

  const member = await prisma.orgMember.findFirst({
    where: { id: input.member_id, orgId },
    include: { role: true },
  });
  if (!member) throw new Error("MEMBER_NOT_FOUND");
  if (member.role.slug === "owner") throw new Error("CANNOT_CHANGE_OWNER_ROLE");

  const newRole = await prisma.orgRole.findFirst({
    where: { id: input.role_id, orgId },
  });
  if (!newRole) throw new Error("ROLE_NOT_FOUND");

  return await prisma.orgMember.update({
    where: { id: input.member_id },
    data: { roleId: input.role_id },
    include: {
      role: { include: { permissions: true } },
      profile: { select: { firstName: true, lastName: true, email: true } },
    },
  });
};

// ─── RBAC Roles ──────────────────────────────────────────────────────────────

// ✨ ดึง Roles ทั้งหมดขององค์กร (รวม permissions และ member count)
export const getOrgRolesService = async (userId: string, delegatedOrgId?: string | null) => {
  const orgId = await resolveOrgId(userId, "members:view", delegatedOrgId);
  await ensureSystemRolesService(orgId);

  return await prisma.orgRole.findMany({
    where: { orgId },
    include: {
      permissions: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "asc" },
  });
};

// ✨ สร้าง Custom Role ใหม่
export const createRoleService = async (
  userId: string,
  input: CreateRoleInput,
  delegatedOrgId?: string | null,
) => {
  const orgId = await resolveOrgId(userId, "settings:edit", delegatedOrgId);

  const slug = input.name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  const existing = await prisma.orgRole.findUnique({
    where: { unique_org_role_slug: { orgId, slug } },
  });
  if (existing) throw new Error("ROLE_SLUG_EXISTS");

  return await prisma.orgRole.create({
    data: {
      orgId,
      name: input.name,
      slug,
      description: input.description ?? null,
      color: input.color ?? "#94A3B8",
      iconKey: input.icon_key ?? "user",
      isSystem: false,
    },
    include: { permissions: true, _count: { select: { members: true } } },
  });
};

// ✨ แก้ไขข้อมูล Role (ชื่อ, คำอธิบาย, สี, icon)
export const updateRoleService = async (
  userId: string,
  roleId: string,
  input: UpdateRoleInput,
  delegatedOrgId?: string | null,
) => {
  const orgId = await resolveOrgId(userId, "settings:edit", delegatedOrgId);

  const role = await prisma.orgRole.findFirst({ where: { id: roleId, orgId } });
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.isSystem) throw new Error("CANNOT_EDIT_SYSTEM_ROLE");

  return await prisma.orgRole.update({
    where: { id: roleId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.color && { color: input.color }),
      ...(input.icon_key && { iconKey: input.icon_key }),
    },
    include: { permissions: true, _count: { select: { members: true } } },
  });
};

// ✨ ลบ Custom Role
export const deleteRoleService = async (userId: string, roleId: string, delegatedOrgId?: string | null) => {
  const orgId = await resolveOrgId(userId, "settings:edit", delegatedOrgId);

  const role = await prisma.orgRole.findFirst({ where: { id: roleId, orgId } });
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.isSystem) throw new Error("CANNOT_DELETE_SYSTEM_ROLE");

  const memberCount = await prisma.orgMember.count({ where: { roleId } });
  if (memberCount > 0) throw new Error("ROLE_HAS_MEMBERS");

  return await prisma.orgRole.delete({ where: { id: roleId } });
};

// ✨ อัปเดต Permissions ของ Role (replace strategy)
export const updateRolePermissionsService = async (
  userId: string,
  roleId: string,
  input: UpdatePermissionsInput,
  delegatedOrgId?: string | null,
) => {
  const orgId = await resolveOrgId(userId, "settings:edit", delegatedOrgId);

  const role = await prisma.orgRole.findFirst({ where: { id: roleId, orgId } });
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.isSystem) throw new Error("CANNOT_EDIT_SYSTEM_ROLE");

  return await prisma.$transaction(async (tx) => {
    await tx.orgRolePermission.deleteMany({ where: { roleId } });
    await tx.orgRolePermission.createMany({
      data: input.permissions.map((key) => ({ roleId, permissionKey: key })),
    });
    return tx.orgRole.findUnique({
      where: { id: roleId },
      include: { permissions: true, _count: { select: { members: true } } },
    });
  });
};

// ─── Delegated Access (ฝั่งผู้รับสิทธิ์) ────────────────────────────────────

// ✨ ดึงรายการองค์กรที่ User นี้ถูก delegate ให้เข้าถึง
export const getDelegatedAccessService = async (userId: string) => {
  const profileId = await getProfileId(userId);

  return await prisma.orgMember.findMany({
    where: { profileId },
    include: {
      schoolProfile: {
        select: {
          id: true,
          schoolName: true,
          schoolType: true,
          province: true,
          logoUrl: true,
          profile: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
      role: {
        include: { permissions: true },
      },
      inviter: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ✨ ดึงรายการ invite ที่รอการตอบรับของ email นี้
export const getPendingInvitesByEmailService = async (email: string) => {
  const now = new Date();
  return await prisma.orgInvite.findMany({
    where: { email, status: "PENDING", expiresAt: { gt: now } },
    include: {
      schoolProfile: {
        select: { schoolName: true, province: true, logoUrl: true },
      },
      inviter: { select: { firstName: true, lastName: true } },
    },
  });
};

// ✨ ยอมรับคำเชิญ (invite token)
export const acceptInviteService = async (userId: string, token: string) => {
  const profileId = await getProfileId(userId);
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { email: true },
  });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const now = new Date();
  const invite = await prisma.orgInvite.findFirst({
    where: {
      token,
      email: profile.email,
      status: "PENDING",
      expiresAt: { gt: now },
    },
  });
  if (!invite) throw new Error("INVITE_NOT_FOUND_OR_EXPIRED");

  // ตรวจสอบว่าเป็นสมาชิกอยู่แล้วหรือเปล่า
  const existing = await prisma.orgMember.findFirst({
    where: { orgId: invite.orgId, profileId },
  });
  if (existing) throw new Error("ALREADY_MEMBER");

  return await prisma.$transaction(async (tx) => {
    await tx.orgInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
    return tx.orgMember.create({
      data: {
        orgId: invite.orgId,
        profileId,
        roleId: invite.roleId,
        status: OrgMemberStatus.ACTIVE,
        invitedBy: invite.invitedBy,
        joinedAt: new Date(),
      },
    });
  });
};
