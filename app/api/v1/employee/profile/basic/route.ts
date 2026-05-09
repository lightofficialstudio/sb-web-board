import { updateBasicSchema } from "./validation/basic-schema";
import { updateBasicService } from "./service/basic-service";

// ✨ PATCH /api/v1/employee/profile/basic?user_id=xxx — อัปเดตข้อมูลพื้นฐานของ Employee Profile
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id") ?? "";

    if (!userId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id",
          message_en: "user_id is required",
          data: null,
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // 📝 Validate request body ด้วย Zod Schema
    const parsed = updateBasicSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ข้อมูลไม่ถูกต้อง",
          message_en: "Invalid request body",
          data: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await updateBasicService(userId, parsed.data);

    return Response.json(
      {
        status_code: 200,
        message_th: "อัปเดตข้อมูลพื้นฐานสำเร็จ",
        message_en: "Basic info updated successfully",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    // ❌ จัดการกรณี profile ไม่พบ
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      return Response.json(
        {
          status_code: 404,
          message_th: "ไม่พบข้อมูลโปรไฟล์",
          message_en: "Profile not found",
          data: null,
        },
        { status: 404 }
      );
    }

    console.error("❌ [employee/profile/basic]:", error);
    return Response.json(
      {
        status_code: 500,
        message_th: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
        message_en: "Internal server error",
        data: null,
      },
      { status: 500 }
    );
  }
}
