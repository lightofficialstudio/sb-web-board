import { prisma } from "@/lib/prisma";
import { UpdateSummaryInput } from "../validation/summary-schema";

// ✨ อัปเดต Personal Summary + Teaching Specialization + Work Location ของ Employee Profile
// ใช้ prisma.$transaction เพื่อ replace array relations ทั้งหมดใน Transaction เดียว
export const updateSummaryService = async (
  userId: string,
  payload: UpdateSummaryInput
) => {
  const { specializations, grade_can_teaches, preferred_provinces, ...scalarFields } =
    payload;

  return await prisma.$transaction(async (tx) => {
    // 📝 ดึง profile id จาก userId ก่อน
    const profile = await tx.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    const profileId = profile.id;

    // ✨ อัปเดต scalar fields ของ Profile (เฉพาะ field ที่ส่งมา)
    const updatedProfile = await tx.profile.update({
      where: { userId },
      data: {
        ...(scalarFields.special_activities !== undefined && {
          specialActivities: scalarFields.special_activities,
        }),
        ...(scalarFields.teaching_experience !== undefined && {
          teachingExperience: scalarFields.teaching_experience,
        }),
        ...(scalarFields.recent_school !== undefined && {
          recentSchool: scalarFields.recent_school,
        }),
        ...(scalarFields.can_relocate !== undefined && {
          canRelocate: scalarFields.can_relocate,
        }),
        ...(scalarFields.license_status !== undefined && {
          licenseStatus: scalarFields.license_status as
            | "has_license"
            | "pending"
            | "no_license"
            | "not_required"
            | null,
        }),
      },
    });

    // ✨ Sync specializations — ลบของเดิมและสร้างใหม่ทั้งหมด (replace strategy)
    if (specializations !== undefined) {
      await tx.specialization.deleteMany({ where: { profileId } });
      if (specializations.length > 0) {
        await tx.specialization.createMany({
          data: specializations.map((subject) => ({ profileId, subject })),
        });
      }
    }

    // ✨ Sync grade_can_teaches
    if (grade_can_teaches !== undefined) {
      await tx.gradeCanTeach.deleteMany({ where: { profileId } });
      if (grade_can_teaches.length > 0) {
        await tx.gradeCanTeach.createMany({
          data: grade_can_teaches.map((grade) => ({ profileId, grade })),
        });
      }
    }

    // ✨ Sync preferred_provinces
    if (preferred_provinces !== undefined) {
      await tx.preferredProvince.deleteMany({ where: { profileId } });
      if (preferred_provinces.length > 0) {
        await tx.preferredProvince.createMany({
          data: preferred_provinces.map((province) => ({ profileId, province })),
        });
      }
    }

    return updatedProfile;
  });
};
