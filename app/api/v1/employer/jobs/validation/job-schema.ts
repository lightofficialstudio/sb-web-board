import { z } from "zod";

// 📝 Schema สำหรับ Create Job
export const createJobSchema = z.object({
  title: z.string().min(1, "กรุณาระบุตำแหน่งงาน"),
  employment_type: z.string().optional().nullable(),
  vacancy_count: z.number().int().positive().default(1),
  subjects: z.array(z.string()).optional().default([]),
  grades: z.array(z.string()).optional().default([]),
  salary_type: z
    .enum(["SPECIFY", "NEGOTIABLE", "RANGE", "NOT_SPECIFIED"])
    .optional()
    .nullable(),
  salary_min: z.number().int().nonnegative().optional().nullable(),
  salary_max: z.number().int().nonnegative().optional().nullable(),
  salary_negotiable: z.boolean().default(false),
  description: z.string().optional().nullable(),
  education_level: z.string().optional().nullable(),
  experience: z.string().optional().nullable(),
  license: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  qualifications: z.string().optional().nullable(),
  province: z.string().min(1, "กรุณาระบุจังหวัด"),
  area: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  deadline_days: z.number().int().nonnegative().optional().nullable(),
  is_published: z.boolean().default(false),
  benefits: z.array(z.string()).optional().default([]),
});

// 📝 Schema สำหรับ Update Job (ทุก field optional ยกเว้น title + province ถ้าส่งมา)
export const updateJobSchema = createJobSchema.partial();

// 📝 Schema สำหรับ Query params
export const getJobQuerySchema = z.object({
  user_id: z.string().min(1, "กรุณาระบุ user_id"),
  job_id: z.string().uuid("job_id ต้องเป็น UUID").optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
