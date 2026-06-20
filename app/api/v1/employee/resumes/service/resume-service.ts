import { prisma } from "@/lib/prisma";
import { CreateResumeInput, UpdateResumeInput } from "../validation/resume-schema";

// ✨ สร้าง Resume ใหม่ โดยดึง profileId จาก userId
export const createResumeService = async (userId: string, payload: CreateResumeInput) => {
  // ✨ ดึง profileId จาก userId
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  return await prisma.resume.create({
    data: {
      profileId: profile.id,
      fileName: payload.file_name,
      fileUrl: payload.file_url,
      fileSize: payload.file_size ?? null,
      isActive: false,
      isDeleted: false,
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileSize: true,
      isActive: true,
      uploadedAt: true,
    },
  });
};

// ✨ อัปเดต Resume — ถ้า is_active: true ให้ reset ทุกตัวก่อน แล้วค่อย set active
export const updateResumeService = async (id: string, payload: UpdateResumeInput) => {
  if (payload.is_active) {
    // ✨ ดึง profileId ของ resume ตัวนี้
    const resume = await prisma.resume.findUnique({
      where: { id },
      select: { profileId: true },
    });

    if (resume) {
      // ✨ reset isActive ทั้งหมดของ profile นี้ก่อน
      await prisma.resume.updateMany({
        where: { profileId: resume.profileId, isDeleted: false },
        data: { isActive: false },
      });
    }
  }

  return await prisma.resume.update({
    where: { id },
    data: {
      ...(payload.file_name !== undefined && { fileName: payload.file_name }),
      ...(payload.is_active !== undefined && { isActive: payload.is_active }),
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileSize: true,
      isActive: true,
      uploadedAt: true,
    },
  });
};

// ✨ Soft-delete Resume — set isDeleted: true และ isActive: false
export const deleteResumeService = async (id: string) => {
  return await prisma.resume.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
    select: { id: true },
  });
};
