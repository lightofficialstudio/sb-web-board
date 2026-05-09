import { createJobService } from "../service/job-service";
import { createJobSchema } from "../validation/job-schema";

// ✨ POST /api/v1/jobs/create?user_id=xxx — สร้างประกาศงานใหม่
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

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

    // ✨ รับ delegated_school_profile_id เมื่อ EMPLOYER ทำงานแทนโรงเรียนอื่น
    const delegatedSchoolProfileId =
      searchParams.get("school_profile_id") ?? null;

    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ข้อมูลไม่ถูกต้อง",
          message_en: "Invalid request body",
          data: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const job = await createJobService(userId, parsed.data, delegatedSchoolProfileId);

    return Response.json(
      {
        status_code: 201,
        message_th: "สร้างประกาศงานสำเร็จ",
        message_en: "Job created successfully",
        data: job,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "SCHOOL_PROFILE_NOT_FOUND") {
      return Response.json(
        {
          status_code: 404,
          message_th: "ไม่พบโปรไฟล์โรงเรียน กรุณาตั้งค่าโปรไฟล์ก่อน",
          message_en: "School profile not found",
          data: null,
        },
        { status: 404 },
      );
    }
    if (message === "DELEGATED_PERMISSION_DENIED") {
      return Response.json(
        {
          status_code: 403,
          message_th: "ไม่มีสิทธิ์สร้างประกาศงานสำหรับโรงเรียนนี้",
          message_en: "Permission denied for delegated school",
          data: null,
        },
        { status: 403 },
      );
    }
    console.error("❌ [jobs/create]", err);
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
