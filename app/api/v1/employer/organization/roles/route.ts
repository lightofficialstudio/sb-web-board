import {
  createRoleService,
  deleteRoleService,
  getOrgRolesService,
  updateRoleService,
} from "../service/org-service";
import { createRoleSchema, updateRoleSchema } from "../validation/org-schema";

// ✨ GET /api/v1/employer/organization/roles?user_id=xxx[&school_profile_id=xxx]
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id",
          message_en: "user_id is required",
          data: null,
        },
        { status: 400 },
      );
    }
    const roles = await getOrgRolesService(userId, delegatedOrgId);
    return Response.json({
      status_code: 200,
      message_th: "ดึงข้อมูลสำเร็จ",
      message_en: "OK",
      data: roles,
    });
  } catch (err) {
    console.error("❌ [org/roles GET]", err);
    return Response.json(
      {
        status_code: 500,
        message_th: "เกิดข้อผิดพลาดภายในระบบ",
        message_en: "Internal server error",
        data: null,
      },
      { status: 500 },
    );
  }
}

// ✨ POST /api/v1/employer/organization/roles?user_id=xxx[&school_profile_id=xxx] — สร้าง Custom Role
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id",
          message_en: "user_id is required",
          data: null,
        },
        { status: 400 },
      );
    }
    const body = await request.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ข้อมูลไม่ถูกต้อง",
          message_en: "Validation error",
          data: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const role = await createRoleService(userId, parsed.data, delegatedOrgId);
    return Response.json(
      {
        status_code: 201,
        message_th: "สร้าง Role สำเร็จ",
        message_en: "Created",
        data: role,
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      ROLE_SLUG_EXISTS: [409, "ชื่อ Role นี้มีอยู่แล้ว"],
      DELEGATED_PERMISSION_DENIED: [403, "ไม่มีสิทธิ์จัดการ Role ขององค์กรนี้"],
    };
    if (map[msg])
      return Response.json(
        {
          status_code: map[msg][0],
          message_th: map[msg][1],
          message_en: msg,
          data: null,
        },
        { status: map[msg][0] },
      );
    console.error("❌ [org/roles POST]", err);
    return Response.json(
      {
        status_code: 500,
        message_th: "เกิดข้อผิดพลาดภายในระบบ",
        message_en: "Internal server error",
        data: null,
      },
      { status: 500 },
    );
  }
}

// ✨ PATCH /api/v1/employer/organization/roles?user_id=xxx&role_id=xxx[&school_profile_id=xxx]
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const roleId = searchParams.get("role_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId || !roleId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id และ role_id",
          message_en: "Required params missing",
          data: null,
        },
        { status: 400 },
      );
    }
    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ข้อมูลไม่ถูกต้อง",
          message_en: "Validation error",
          data: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const role = await updateRoleService(
      userId,
      roleId,
      parsed.data,
      delegatedOrgId,
    );
    return Response.json({
      status_code: 200,
      message_th: "อัปเดต Role สำเร็จ",
      message_en: "Updated",
      data: role,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      ROLE_NOT_FOUND: [404, "ไม่พบ Role"],
      CANNOT_EDIT_SYSTEM_ROLE: [403, "ไม่สามารถแก้ไข System Role ได้"],
      DELEGATED_PERMISSION_DENIED: [403, "ไม่มีสิทธิ์จัดการ Role ขององค์กรนี้"],
    };
    if (map[msg])
      return Response.json(
        {
          status_code: map[msg][0],
          message_th: map[msg][1],
          message_en: msg,
          data: null,
        },
        { status: map[msg][0] },
      );
    console.error("❌ [org/roles PATCH]", err);
    return Response.json(
      {
        status_code: 500,
        message_th: "เกิดข้อผิดพลาดภายในระบบ",
        message_en: "Internal server error",
        data: null,
      },
      { status: 500 },
    );
  }
}

// ✨ DELETE /api/v1/employer/organization/roles?user_id=xxx&role_id=xxx[&school_profile_id=xxx]
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const roleId = searchParams.get("role_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId || !roleId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id และ role_id",
          message_en: "Required params missing",
          data: null,
        },
        { status: 400 },
      );
    }
    await deleteRoleService(userId, roleId, delegatedOrgId);
    return Response.json({
      status_code: 200,
      message_th: "ลบ Role สำเร็จ",
      message_en: "Deleted",
      data: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      ROLE_NOT_FOUND: [404, "ไม่พบ Role"],
      CANNOT_DELETE_SYSTEM_ROLE: [403, "ไม่สามารถลบ System Role ได้"],
      ROLE_HAS_MEMBERS: [409, "ไม่สามารถลบ Role ที่ยังมีสมาชิกอยู่ได้"],
      DELEGATED_PERMISSION_DENIED: [403, "ไม่มีสิทธิ์จัดการ Role ขององค์กรนี้"],
    };
    if (map[msg])
      return Response.json(
        {
          status_code: map[msg][0],
          message_th: map[msg][1],
          message_en: msg,
          data: null,
        },
        { status: map[msg][0] },
      );
    console.error("❌ [org/roles DELETE]", err);
    return Response.json(
      {
        status_code: 500,
        message_th: "เกิดข้อผิดพลาดภายในระบบ",
        message_en: "Internal server error",
        data: null,
      },
      { status: 500 },
    );
  }
}
