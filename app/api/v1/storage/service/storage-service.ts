import { createClient } from "@supabase/supabase-js";

// ✨ ใช้ Service Role Key เพื่อ bypass RLS ในฝั่ง Server (API route เท่านั้น)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Bucket names
export const BUCKETS = {
  AVATARS: "avatars", // public — รูปโปรไฟล์
  RESUMES: "resumes", // private — เรซูเม่ PDF
  LICENSES: "licenses", // private — ใบประกอบวิชาชีพ
  BLOG_COVERS: "blog-covers", // public — รูป cover บทความ
  BLOG_IMAGES: "blog-images", // public — รูปภายในเนื้อหาบทความ
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ✨ Public buckets ที่ต้องสร้างอัตโนมัติหากยังไม่มี
const PUBLIC_BUCKETS: string[] = [
  BUCKETS.AVATARS,
  BUCKETS.BLOG_COVERS,
  BUCKETS.BLOG_IMAGES,
];

// ✨ Ensure bucket มีอยู่ก่อน upload — ป้องกัน 500 เมื่อ bucket ไม่ถูก create ใน Supabase
const ensureBucket = async (bucket: string): Promise<void> => {
  const isPublic = PUBLIC_BUCKETS.includes(bucket);
  const { error } = await supabaseAdmin.storage.createBucket(bucket, {
    public: isPublic,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ],
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  });
  // "already exists" ไม่ใช่ error — ภาวะปกติ
  if (
    error &&
    !error.message.toLowerCase().includes("already exists") &&
    !error.message.toLowerCase().includes("duplicate")
  ) {
    console.warn(`[storage] ensureBucket "${bucket}":`, error.message);
  }
};

// ✨ Sanitize ชื่อไฟล์ให้ใช้ได้กับ Supabase Storage key (รองรับภาษาไทย + ช่องว่าง)
// — แปลง Unicode → transliterate, แทนที่ช่องว่างด้วย underscore, เหลือเฉพาะ ASCII ที่ปลอดภัย
const sanitizeFileName = (name: string): string => {
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  const base = name.replace(/\.[^.]+$/, "");
  // แปลงอักขระที่ไม่ใช่ ASCII ตัวอักษร ตัวเลข จุด ขีด → underscore
  const safe = base
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${safe || "file"}${ext}`;
};

// ✨ Upload ไฟล์ไปยัง Supabase Storage
// path รูปแบบ: {userId}/{filename} เพื่อแยก folder ตาม user
export const uploadFileService = async (
  bucket: BucketName,
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ url: string; path: string }> => {
  const safeFileName = sanitizeFileName(fileName);
  const filePath = `${userId}/${Date.now()}_${safeFileName}`;

  // ✨ Ensure bucket มีอยู่ก่อน upload (ป้องกัน 500 จาก bucket not found)
  await ensureBucket(bucket);

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error(`[storage] upload to ${bucket}/${filePath} failed:`, error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // ✨ Public bucket → getPublicUrl, Private bucket → createSignedUrl (1 ชั่วโมง)
  if (bucket === BUCKETS.AVATARS || bucket === BUCKETS.BLOG_COVERS) {
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    return { url: data.publicUrl, path: filePath };
  }

  // Private buckets — คืน path กลับไป ให้ frontend ขอ signed URL ตอนแสดงผล
  const publicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;
  return { url: publicBase, path: filePath };
};

// ✨ สร้าง Signed URL สำหรับ private file (อายุ 1 ชั่วโมง)
export const getSignedUrlService = async (
  bucket: BucketName,
  filePath: string,
  expiresInSeconds = 3600,
): Promise<string> => {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
};

// ✨ ลบไฟล์ออกจาก Supabase Storage
export const deleteFileService = async (
  bucket: BucketName,
  filePath: string,
): Promise<void> => {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
};
