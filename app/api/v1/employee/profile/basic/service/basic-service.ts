import { prisma } from "@/lib/prisma";
import { UpdateBasicInput } from "../validation/basic-schema";

// ✨ อัปเดตข้อมูลพื้นฐาน (Basic Info) ของ Employee Profile
// รองรับเฉพาะ identity fields — first_name, last_name, phone_number, gender,
// date_of_birth, nationality, profile_image_url, profile_visibility
export const updateBasicService = async (
  userId: string,
  payload: UpdateBasicInput
) => {
  // 📝 ตรวจสอบว่า profile มีอยู่ก่อนอัปเดต
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  // ✨ อัปเดตเฉพาะ field ที่ส่งมา (undefined → ไม่อัปเดต field นั้น)
  return await prisma.profile.update({
    where: { userId },
    data: {
      ...(payload.first_name !== undefined && { firstName: payload.first_name }),
      ...(payload.last_name !== undefined && { lastName: payload.last_name }),
      ...(payload.phone_number !== undefined && { phoneNumber: payload.phone_number }),
      ...(payload.gender !== undefined && { gender: payload.gender }),
      ...(payload.date_of_birth !== undefined && {
        dateOfBirth: payload.date_of_birth ? new Date(payload.date_of_birth) : null,
      }),
      ...(payload.nationality !== undefined && { nationality: payload.nationality }),
      ...(payload.profile_image_url !== undefined && { profileImageUrl: payload.profile_image_url }),
      ...(payload.profile_visibility !== undefined && {
        profileVisibility: payload.profile_visibility as "public" | "apply_only",
      }),
    },
  });
};
