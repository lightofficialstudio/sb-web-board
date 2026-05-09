import { sendInviteEmail } from "@/lib/mailer";
import { createNotification } from "@/lib/notification";
import { prisma } from "@/lib/prisma";
import {
  getPendingInvitesService,
  inviteMemberService,
  revokeInviteService,
} from "../service/org-service";
import { inviteMemberSchema } from "../validation/org-schema";

// ✨ GET /api/v1/employer/organization/invites?user_id=xxx[&school_profile_id=xxx] — ดึงคำเชิญที่รอ
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id",
          message_en: "user_id is required",
          data: null,
        },
        { status: 400 },
      );
    }
    const invites = await getPendingInvitesService(userId, delegatedOrgId);
    return Response.json({
      status_code: 200,
      message_th: "ดึงข้อมูลสำเร็จ",
      message_en: "OK",
      data: invites,
    });
  } catch (err) {
    console.error("❌ [org/invites GET]", err);
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

// ✨ POST /api/v1/employer/organization/invites?user_id=xxx[&school_profile_id=xxx] — เชิญสมาชิกใหม่ + ส่ง Email
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id",
          message_en: "user_id is required",
          data: null,
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          status_code: 400,
          message_th: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
          message_en: "Validation error",
          data: null,
        },
        { status: 400 },
      );
    }

    // ✨ สร้าง invite record ใน DB
    const invite = await inviteMemberService(
      userId,
      parsed.data,
      delegatedOrgId,
    );

    // ✨ ดึงข้อมูลเพิ่มเติมสำหรับอีเมล (ชื่อโรงเรียน, ชื่อผู้เชิญ, ชื่อ role)
    const [schoolProfile, role] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: { schoolProfile: { select: { schoolName: true } } },
      }),
      prisma.orgRole.findUnique({
        where: { id: parsed.data.role_id },
        select: { name: true },
      }),
    ]);

    const schoolName = schoolProfile?.schoolProfile?.schoolName ?? "โรงเรียน";
    const inviterName =
      `${invite.inviter?.firstName ?? ""} ${invite.inviter?.lastName ?? ""}`.trim() ||
      "ผู้ดูแลระบบ";
    const roleName = role?.name ?? "สมาชิก";

    // ✨ ส่งอีเมลจริง (ไม่ block response ถ้า mail fail)
    try {
      await sendInviteEmail({
        toEmail: parsed.data.email,
        schoolName,
        inviterName,
        roleName,
        inviteToken: invite.token,
        expiresAt: invite.expiresAt,
      });
    } catch (mailErr) {
      console.error("❌ [mailer] ส่ง invite email ล้มเหลว:", mailErr);
    }

    // ✨ ส่ง notification ให้ผู้รับเชิญ (ถ้ามี profile ในระบบแล้ว)
    try {
      const inviteeProfile = await prisma.profile.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });
      if (inviteeProfile) {
        await createNotification({
          profileId: inviteeProfile.id,
          type: "invite_sent",
          title: `คุณได้รับคำเชิญจาก ${schoolName}`,
          message: `${inviterName} เชิญคุณเข้าร่วมในฐานะ ${roleName}`,
          referenceId: invite.id,
          referenceType: "invite",
        });
      }
    } catch (notifErr) {
      console.error(
        "❌ [notification] สร้าง invite notification ล้มเหลว:",
        notifErr,
      );
    }

    return Response.json(
      {
        status_code: 201,
        message_th: "ส่งคำเชิญสำเร็จ",
        message_en: "Invite sent",
        data: invite,
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const errMap: Record<string, [number, string]> = {
      ALREADY_MEMBER: [409, "อีเมลนี้เป็นสมาชิกอยู่แล้ว"],
      ROLE_NOT_FOUND: [404, "ไม่พบ Role ที่ระบุ"],
      DELEGATED_PERMISSION_DENIED: [403, "ไม่มีสิทธิ์จัดการสมาชิกขององค์กรนี้"],
    };
    if (errMap[msg])
      return Response.json(
        {
          status_code: errMap[msg][0],
          message_th: errMap[msg][1],
          message_en: msg,
          data: null,
        },
        { status: errMap[msg][0] },
      );
    console.error("❌ [org/invites POST]", err);
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

// ✨ DELETE /api/v1/employer/organization/invites?user_id=xxx&invite_id=xxx[&school_profile_id=xxx] — ยกเลิกคำเชิญ
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const inviteId = searchParams.get("invite_id");
    const delegatedOrgId = searchParams.get("school_profile_id") ?? null;
    if (!userId || !inviteId) {
      return Response.json(
        {
          status_code: 400,
          message_th: "กรุณาระบุ user_id และ invite_id",
          message_en: "Required params missing",
          data: null,
        },
        { status: 400 },
      );
    }
    await revokeInviteService(userId, inviteId, delegatedOrgId);
    return Response.json({
      status_code: 200,
      message_th: "ยกเลิกคำเชิญสำเร็จ",
      message_en: "Revoked",
      data: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const map: Record<string, [number, string]> = {
      INVITE_NOT_FOUND: [404, "ไม่พบคำเชิญ"],
      DELEGATED_PERMISSION_DENIED: [403, "ไม่มีสิทธิ์จัดการสมาชิกขององค์กรนี้"],
    };
    if (map[msg])
      return Response.json(
        {
          status_code: map[msg][0],
          message_th: map[msg][1],
          message_en: msg,
          data: null,
        },
        { status: map[msg][0] },
      );
    console.error("❌ [org/invites DELETE]", err);
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
