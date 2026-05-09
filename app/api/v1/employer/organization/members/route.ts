import {
  getOrgMembersService,
  inviteMemberService,
  removeMemberService,
  updateMemberRoleService,
} from "../service/org-service";
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "../validation/org-schema";

const DELEGATED_ERROR = { status_code: 403, message_th: "ไม่มีสิทธิ์จัดการสมาชิกขององค์กรนี้", message_en: "DELEGATED_PERMISSION_DENIED", data: null };

// ✨ GET /api/v1/employer/organization/members?user_id=xxx[&school_profile_id=xxx]
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json({ status_code: 400, message_th: "กรุณาระบุ user_id", message_en: "user_id is required", data: null }, { status: 400 });
    }
    const members = await getOrgMembersService(userId, delegatedOrgId);
    return Response.json({ status_code: 200, message_th: "ดึงข้อมูลสำเร็จ", message_en: "OK", data: members });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    if (msg === "SCHOOL_PROFILE_NOT_FOUND") return Response.json({ status_code: 404, message_th: "ไม่พบโปรไฟล์โรงเรียน", message_en: msg, data: null }, { status: 404 });
    if (msg === "DELEGATED_PERMISSION_DENIED") return Response.json(DELEGATED_ERROR, { status: 403 });
    console.error("❌ [org/members GET]", err);
    return Response.json({ status_code: 500, message_th: "เกิดข้อผิดพลาดภายในระบบ", message_en: "Internal server error", data: null }, { status: 500 });
  }
}

// ✨ POST /api/v1/employer/organization/members?user_id=xxx[&school_profile_id=xxx]
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json({ status_code: 400, message_th: "กรุณาระบุ user_id", message_en: "user_id is required", data: null }, { status: 400 });
    }
    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ status_code: 400, message_th: "ข้อมูลไม่ถูกต้อง", message_en: "Validation error", data: parsed.error.flatten() }, { status: 400 });
    }
    const invite = await inviteMemberService(userId, parsed.data, delegatedOrgId);
    return Response.json({ status_code: 201, message_th: "ส่งคำเชิญสำเร็จ", message_en: "Invite sent", data: invite }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      SCHOOL_PROFILE_NOT_FOUND:   [404, "ไม่พบโปรไฟล์โรงเรียน"],
      ROLE_NOT_FOUND:             [404, "ไม่พบ Role ที่ระบุ"],
      ALREADY_MEMBER:             [409, "อีเมลนี้เป็นสมาชิกอยู่แล้ว"],
      DELEGATED_PERMISSION_DENIED:[403, "ไม่มีสิทธิ์จัดการสมาชิกขององค์กรนี้"],
    };
    if (map[msg]) return Response.json({ status_code: map[msg][0], message_th: map[msg][1], message_en: msg, data: null }, { status: map[msg][0] });
    console.error("❌ [org/members POST]", err);
    return Response.json({ status_code: 500, message_th: "เกิดข้อผิดพลาดภายในระบบ", message_en: "Internal server error", data: null }, { status: 500 });
  }
}

// ✨ PATCH /api/v1/employer/organization/members?user_id=xxx[&school_profile_id=xxx]
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json({ status_code: 400, message_th: "กรุณาระบุ user_id", message_en: "user_id is required", data: null }, { status: 400 });
    }
    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ status_code: 400, message_th: "ข้อมูลไม่ถูกต้อง", message_en: "Validation error", data: parsed.error.flatten() }, { status: 400 });
    }
    const member = await updateMemberRoleService(userId, parsed.data, delegatedOrgId);
    return Response.json({ status_code: 200, message_th: "อัปเดต Role สำเร็จ", message_en: "Updated", data: member });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      MEMBER_NOT_FOUND:           [404, "ไม่พบสมาชิก"],
      ROLE_NOT_FOUND:             [404, "ไม่พบ Role ที่ระบุ"],
      CANNOT_CHANGE_OWNER_ROLE:   [403, "ไม่สามารถเปลี่ยน Role ของ Owner ได้"],
      DELEGATED_PERMISSION_DENIED:[403, "ไม่มีสิทธิ์จัดการสมาชิกขององค์กรนี้"],
    };
    if (map[msg]) return Response.json({ status_code: map[msg][0], message_th: map[msg][1], message_en: msg, data: null }, { status: map[msg][0] });
    console.error("❌ [org/members PATCH]", err);
    return Response.json({ status_code: 500, message_th: "เกิดข้อผิดพลาดภายในระบบ", message_en: "Internal server error", data: null }, { status: 500 });
  }
}

// ✨ DELETE /api/v1/employer/organization/members?user_id=xxx&member_id=xxx[&school_profile_id=xxx]
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId   = searchParams.get("user_id");
    const memberId = searchParams.get("member_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId || !memberId) {
      return Response.json({ status_code: 400, message_th: "กรุณาระบุ user_id และ member_id", message_en: "Required params missing", data: null }, { status: 400 });
    }
    await removeMemberService(userId, memberId, delegatedOrgId);
    return Response.json({ status_code: 200, message_th: "ลบสมาชิกสำเร็จ", message_en: "Removed", data: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      MEMBER_NOT_FOUND:           [404, "ไม่พบสมาชิก"],
      CANNOT_REMOVE_OWNER:        [403, "ไม่สามารถลบ Owner ออกได้"],
      DELEGATED_PERMISSION_DENIED:[403, "ไม่มีสิทธิ์จัดการสมาชิกขององค์กรนี้"],
    };
    if (map[msg]) return Response.json({ status_code: map[msg][0], message_th: map[msg][1], message_en: msg, data: null }, { status: map[msg][0] });
    console.error("❌ [org/members DELETE]", err);
    return Response.json({ status_code: 500, message_th: "เกิดข้อผิดพลาดภายในระบบ", message_en: "Internal server error", data: null }, { status: 500 });
  }
}
