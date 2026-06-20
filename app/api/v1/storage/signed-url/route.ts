import { getSignedUrlService } from "../service/storage-service";
import type { BucketName } from "../service/storage-service";

const PRIVATE_BUCKETS: string[] = ["resumes", "licenses"];

// ✨ GET /api/v1/storage/signed-url?bucket=resumes&path=userId/file.pdf — คืน Signed URL สำหรับ private file
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const path = searchParams.get("path");

    if (!bucket || !path) {
      return Response.json(
        { status_code: 400, message_th: "กรุณาระบุ bucket และ path", message_en: "bucket and path are required", data: null },
        { status: 400 },
      );
    }

    if (!PRIVATE_BUCKETS.includes(bucket)) {
      return Response.json(
        { status_code: 400, message_th: "bucket ไม่รองรับ", message_en: "Unsupported bucket", data: null },
        { status: 400 },
      );
    }

    const signedUrl = await getSignedUrlService(bucket as BucketName, path);

    return Response.json(
      { status_code: 200, message_th: "สร้าง Signed URL สำเร็จ", message_en: "Signed URL created", data: { url: signedUrl } },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ [GET /api/v1/storage/signed-url]:", error);
    return Response.json(
      { status_code: 500, message_th: "เกิดข้อผิดพลาดภายในระบบ", message_en: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
