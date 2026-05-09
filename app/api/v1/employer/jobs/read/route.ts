import {
  getJobByIdService,
  getJobsByUserService,
} from "../service/job-service";
import { getJobQuerySchema } from "../validation/job-schema";

// ✨ GET /api/v1/jobs/read?user_id=xxx — ดึงประกาศงานทั้งหมดของโรงเรียน
// ✨ GET /api/v1/jobs/read?user_id=xxx&job_id=xxx — ดึงประกาศงานตาม ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // ✨ รับ school_profile_id เมื่อ EMPLOYER ทำงานแทนโรงเรียนอื่น (delegated)
    const delegatedSchoolProfileId =
      searchParams.get("school_profile_id") ?? null;

    const query = {
      user_id: searchParams.get("user_id") ?? "",
      job_id: searchParams.get("job_id") ?? undefined,
    };

    const parsed = getJobQuerySchema.safeParse(query);
    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ข้อมูลไม่ถูกต้อง",
          message_en: "Invalid query params",
          data: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (parsed.data.job_id) {
      const job = await getJobByIdService(
        parsed.data.user_id,
        parsed.data.job_id,
      );
      if (!job) {
        return Response.json(
          {
            status_code: 404,
            message_th: "ไม่พบประกาศงาน",
            message_en: "Job not found",
            data: null,
          },
          { status: 404 },
        );
      }
      return Response.json({
        status_code: 200,
        message_th: "ดึงข้อมูลสำเร็จ",
        message_en: "Fetched successfully",
        data: job,
      });
    }

    const jobs = await getJobsByUserService(
      parsed.data.user_id,
      delegatedSchoolProfileId,
    );
    return Response.json({
      status_code: 200,
      message_th: "ดึงข้อมูลสำเร็จ",
      message_en: "Fetched successfully",
      data: jobs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "SCHOOL_PROFILE_NOT_FOUND") {
      return Response.json(
        {
          status_code: 404,
          message_th: "ไม่พบโปรไฟล์โรงเรียน",
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
          message_th: "ไม่มีสิทธิ์เข้าถึงข้อมูลของโรงเรียนนี้",
          message_en: "Permission denied for delegated school",
          data: null,
        },
        { status: 403 },
      );
    }
    console.error("❌ [jobs/read]", err);
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
