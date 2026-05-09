import { prisma } from "@/lib/prisma";

// ✨ ดึง notification ของ user (20 รายการล่าสุด) + นับ unread
export const getNotificationsService = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  // ✨ ถ้าไม่มี Profile (Prisma sync ล้มเหลวตอน signup) — return ว่างเปล่าแทน throw
  if (!profile) return { notifications: [], unreadCount: 0 };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({
      where: { profileId: profile.id, isRead: false },
    }),
  ]);

  return { notifications, unreadCount };
};

// ✨ mark notification เดียวว่าอ่านแล้ว
export const markReadService = async (
  userId: string,
  notificationId: string,
) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  // ✨ ถ้าไม่มี Profile — return null แทน throw
  if (!profile) return null;

  return prisma.notification.updateMany({
    where: { id: notificationId, profileId: profile.id },
    data: { isRead: true },
  });
};

// ✨ mark ทั้งหมดว่าอ่านแล้ว
export const markAllReadService = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  // ✨ ถ้าไม่มี Profile — return null แทน throw
  if (!profile) return null;

  return prisma.notification.updateMany({
    where: { profileId: profile.id, isRead: false },
    data: { isRead: true },
  });
};
