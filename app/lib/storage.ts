import axios from "axios";

export type StorageBucket = "avatars" | "resumes" | "licenses" | "blog-covers";

// ✨ Upload ไฟล์ไปยัง Supabase Storage ผ่าน API route (server-side)
// คืน { url, path, file_name, file_size }
export const uploadFile = async (
  bucket: StorageBucket,
  userId: string,
  file: File,
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("user_id", userId);

  const { data } = await axios.post("/api/v1/storage/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data.data as {
    url: string;
    path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  };
};

// ✨ ดึง Signed URL สำหรับ private file (resumes, licenses) — อายุ 1 ชั่วโมง
export const getSignedUrl = async (bucket: StorageBucket, path: string): Promise<string> => {
  const { data } = await axios.get("/api/v1/storage/signed-url", {
    params: { bucket, path },
  });
  return data.data.url as string;
};

// ✨ แยก storage path จาก URL ที่เก็บใน DB (private bucket — ไม่มี /public/ ใน path)
export const extractStoragePath = (url: string, bucket: string): string | null => {
  const marker = `/storage/v1/object/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx !== -1 ? url.slice(idx + marker.length) : null;
};

// ✨ ลบไฟล์ออกจาก Supabase Storage ผ่าน API route
export const deleteFile = async (bucket: StorageBucket, path: string) => {
  await axios.delete("/api/v1/storage/delete", {
    data: { bucket, path },
  });
};

// ✨ แปลง bytes → human-readable string (เช่น 1.2 MB)
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
