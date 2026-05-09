import { z } from "zod";

// 📝 Schema สำหรับอัปเดตข้อมูลพื้นฐาน (Basic Info) ของ Employee Profile
// ทุก field เป็น optional — รองรับ partial update
export const updateBasicSchema = z.object({
  first_name: z.string().min(1, "กรุณาระบุชื่อ").optional(),
  last_name: z.string().min(1, "กรุณาระบุนามสกุล").optional(),
  phone_number: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  profile_image_url: z.string().url().optional().nullable(),
  profile_visibility: z.enum(["public", "apply_only"]).optional(),
});

export type UpdateBasicInput = z.infer<typeof updateBasicSchema>;
