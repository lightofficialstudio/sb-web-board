import { z } from "zod";

// 📝 Schema สำหรับอัปเดต Personal Summary + Teaching Specialization + Work Location
// ทุก field เป็น optional — รองรับ partial update
export const updateSummarySchema = z.object({
  // ✨ ข้อมูลส่วนตัวและประสบการณ์การสอน
  special_activities: z.string().optional().nullable(),
  teaching_experience: z.string().optional().nullable(),
  recent_school: z.string().optional().nullable(),
  can_relocate: z.boolean().optional(),
  license_status: z
    .enum(["has_license", "pending", "no_license", "not_required"])
    .optional()
    .nullable(),

  // ✨ Array relations — ส่งมาเป็น array ทั้งก้อน (replace strategy)
  specializations: z.array(z.string()).optional(),       // วิชาที่สอน
  grade_can_teaches: z.array(z.string()).optional(),     // ระดับชั้นที่สอนได้
  preferred_provinces: z.array(z.string()).optional(),   // จังหวัดที่ต้องการทำงาน
});

export type UpdateSummaryInput = z.infer<typeof updateSummarySchema>;
