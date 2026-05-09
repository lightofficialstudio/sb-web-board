import { updateRolePermissionsService } from "../../service/org-service";
import { updatePermissionsSchema } from "../../validation/org-schema";

// ✨ PUT /api/v1/employer/organization/roles/permissions?user_id=xxx&role_id=xxx[&school_profile_id=xxx]
// อัปเดต permissions ของ Role ทั้งหมด (replace)
export async function PUT(request: Request) {
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
    const parsed = updatePermissionsSchema.safeParse(body);
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
    const role = await updateRolePermissionsService(
      userId,
      roleId,
      parsed.data,
      delegatedOrgId,
    );
    return Response.json({
      status_code: 200,
      message_th: "อัปเดต Permission สำเร็จ",
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
    console.error("❌ [org/roles/permissions PUT]", err);
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
