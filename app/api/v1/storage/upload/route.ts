import {
  BUCKETS,
  BucketName,
  uploadFileService,
} from "../service/storage-service";

const ALLOWED_BUCKETS: BucketName[] = [
  BUCKETS.AVATARS,
  BUCKETS.RESUMES,
  BUCKETS.LICENSES,
  BUCKETS.BLOG_COVERS,
  BUCKETS.BLOG_IMAGES,
];

// 🔐 MIME types ที่อนุญาตต่อ bucket — ป้องกัน content-type spoofing
const ALLOWED_MIME: Record<BucketName, string[]> = {
  avatars: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  resumes: ["application/pdf"],
  licenses: ["application/pdf", "image/jpeg", "image/png"],
  "blog-covers": ["image/jpeg", "image/png", "image/webp", "image/gif"],
  "blog-images": ["image/jpeg", "image/png", "image/webp", "image/gif"],
};

// 🔐 Hard limit ทุก bucket ไม่เกิน 10 MB (server enforced)
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// 🔐 ชื่อไฟล์ต้องไม่มี path traversal หรืออักขระอันตราย
const SAFE_FILENAME_RE = /^[a-zA-Z0-9ก-๙\s._()-]+$/;

// ✨ POST /api/v1/storage/upload
// Body: FormData — fields: file (File), bucket (string), user_id (string)
export async function POST(request: Request) {
  try {
    // 🔐 ป้องกัน Content-Type ที่ไม่ใช่ multipart
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json(
        {
          status_code: 400,
          message_th: "Content-Type ต้องเป็น multipart/form-data",
          message_en: "Content-Type must be multipart/form-data",
          data: null,
        },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as BucketName | null;
    const userId = formData.get("user_id") as string | null;

    // 📝 Validate required fields
    if (!file || !bucket || !userId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาส่ง file, bucket และ user_id",
          message_en: "Missing required fields: file, bucket, user_id",
          data: null,
        },
        { status: 400 },
      );
    }

    // 🔐 Validate bucket whitelist
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return Response.json(
        {
          status_code: 400,
          message_th: "Bucket ไม่ถูกต้อง",
          message_en: "Invalid bucket name",
          data: null,
        },
        { status: 400 },
      );
    }

    // 🔐 Hard limit ขนาดไฟล์ 10 MB (server-side — ไม่เชื่อ client)
    if (file.size > MAX_SIZE_BYTES) {
      return Response.json(
        {
          status_code: 413,
          message_th: "ไฟล์มีขนาดเกิน 10 MB กรุณาบีบอัดไฟล์แล้วลองใหม่",
          message_en: "File exceeds 10 MB limit",
          data: null,
        },
        { status: 413 },
      );
    }

    // 🔐 ป้องกันไฟล์ขนาด 0 bytes
    if (file.size === 0) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ไฟล์ว่างเปล่า ไม่สามารถอัปโหลดได้",
          message_en: "Empty file is not allowed",
          data: null,
        },
        { status: 400 },
      );
    }

    // 🔐 Validate MIME type ตาม bucket whitelist
    if (!ALLOWED_MIME[bucket].includes(file.type)) {
      return Response.json(
        {
          status_code: 415,
          message_th: `ประเภทไฟล์ไม่รองรับ — อนุญาต: ${ALLOWED_MIME[bucket].join(", ")}`,
          message_en: `Unsupported file type. Allowed: ${ALLOWED_MIME[bucket].join(", ")}`,
          data: null,
        },
        { status: 415 },
      );
    }

    // 🔐 ตรวจ magic bytes (file signature) — ป้องกัน MIME spoofing
    const headerBuffer = Buffer.from(await file.slice(0, 8).arrayBuffer());
    const isValidSignature = validateMagicBytes(headerBuffer, file.type);
    if (!isValidSignature) {
      return Response.json(
        {
          status_code: 415,
          message_th: "ตรวจพบไฟล์ที่ไม่ตรงกับประเภทที่ระบุ — ปฏิเสธการอัปโหลด",
          message_en: "File signature does not match declared MIME type",
          data: null,
        },
        { status: 415 },
      );
    }

    // 🔐 Sanitize ชื่อไฟล์ — ป้องกัน path traversal
    const sanitizedName = file.name
      .replace(/\.\./g, "") // ลบ path traversal
      .replace(/[/\\]/g, "") // ลบ slash
      .replace(/[<>:"|?*\x00-\x1f]/g, "") // ลบ control chars
      .trim()
      .slice(0, 200); // จำกัดความยาว

    if (!sanitizedName) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ชื่อไฟล์ไม่ถูกต้อง",
          message_en: "Invalid file name",
          data: null,
        },
        { status: 400 },
      );
    }

    // ✨ แปลง File → Buffer แล้วส่ง upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFileService(
      bucket,
      userId,
      sanitizedName,
      buffer,
      file.type,
    );

    return Response.json(
      {
        status_code: 200,
        message_th: "อัปโหลดไฟล์สำเร็จ",
        message_en: "File uploaded successfully",
        data: {
          url: result.url,
          path: result.path,
          file_name: sanitizedName,
          file_size: file.size,
          mime_type: file.type,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ [storage/upload]:", error);
    return Response.json(
      {
        status_code: 500,
        message_th: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์",
        message_en: "File upload failed",
        data: null,
      },
      { status: 500 },
    );
  }
}

// 🔐 ตรวจ magic bytes ป้องกัน MIME spoofing
function validateMagicBytes(buf: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "application/pdf":
      // PDF magic: %PDF = 25 50 44 46
      return (
        buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
      );
    case "image/jpeg":
      // JPEG magic: FF D8 FF
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      return (
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      );
    case "image/webp":
      // WebP: RIFF....WEBP
      return (
        buf.slice(0, 4).toString() === "RIFF" &&
        buf.slice(8, 12)?.toString() === "WEBP"
      );
    case "image/gif":
      // GIF magic: GIF87a or GIF89a
      return (
        buf.slice(0, 6).toString() === "GIF87a" ||
        buf.slice(0, 6).toString() === "GIF89a"
      );
    default:
      return false;
  }
}
