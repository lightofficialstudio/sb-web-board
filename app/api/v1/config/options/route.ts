import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ✨ GET /api/v1/config/options?group=school_type
// ดึงตัวเลือก dropdown ตาม group (Public — ใช้ใน form ฝั่ง Employer/Employee)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get("group");

    if (!group) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ group",
          message_en: "group is required",
          data: null,
        },
        { status: 400 },
      );
    }

    const options = await prisma.configOption.findMany({
      where: { group, isActive: true },
      select: {
        id: true,
        label: true,
        value: true,
        parentValue: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return Response.json({
      status_code: 200,
      message_th: "ดึงข้อมูลสำเร็จ",
      message_en: "Fetched successfully",
      data: options,
    });
  } catch (error) {
    console.error("❌ [GET /api/v1/config/options]", error);
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

const suggestSchema = z.object({
  group: z.string().min(1),
  label: z.string().min(1),
  // ✨ parent_value ใช้เพื่อระบุว่า position นี้ต้องการระบุวิชาหรือไม่
  parent_value: z.string().nullable().optional(),
});

// ✨ POST /api/v1/config/options — auto-suggest ตำแหน่งงานใหม่จาก Employer
// ถ้ายังไม่มีใน config จะสร้างอัตโนมัติ (skipDuplicates via upsert logic)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = suggestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: "ข้อมูลไม่ถูกต้อง",
          message_en: "Invalid input",
          data: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { group, label, parent_value } = parsed.data;
    // ✨ ใช้ label เป็น value (lowercase, trim) เพื่อ dedup
    const value = label.trim().toLowerCase().replace(/\s+/g, "_");

    const existing = await prisma.configOption.findFirst({
      where: { group, value },
      select: { id: true, label: true, value: true, parentValue: true, sortOrder: true },
    });

    if (existing) {
      return Response.json({
        status_code: 200,
        message_th: "มีตัวเลือกนี้อยู่แล้ว",
        message_en: "Option already exists",
        data: existing,
      });
    }

    const maxOrder = await prisma.configOption.aggregate({
      where: { group },
      _max: { sortOrder: true },
    });

    const option = await prisma.configOption.create({
      data: {
        group,
        label: label.trim(),
        value,
        parentValue: parent_value ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
      select: { id: true, label: true, value: true, parentValue: true, sortOrder: true },
    });

    return Response.json(
      {
        status_code: 201,
        message_th: "เพิ่มตำแหน่งงานใหม่สำเร็จ",
        message_en: "New position created",
        data: option,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ [POST /api/v1/config/options]", error);
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
