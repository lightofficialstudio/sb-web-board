"use client";

import { useTheme } from "@/app/contexts/theme-context";
import { useAuthStore } from "@/app/stores/auth-store";
import { useDelegatedContextStore } from "@/app/stores/delegated-context-store";
import {
  BellOutlined,
  CaretDownOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SolutionOutlined,
  SunOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dropdown,
  Flex,
  Modal,
  Space,
  theme,
  Tooltip,
  Typography,
} from "antd";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { Text } = Typography;

// ✨ รูปแบบข้อมูล delegated access จาก API
interface DelegatedSchool {
  id: string;
  schoolProfile: {
    id: string;
    schoolName: string;
    schoolType?: string | null;
    province: string;
    logoUrl?: string | null;
  };
  role: {
    name: string;
    color: string;
    permissions: { permissionKey: string }[];
  };
}

// ✨ รูปแบบ notification จาก API
interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  imageUrl?: string | null;
  isRead: boolean;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

// ✨ แปลง type → icon emoji
const NOTIF_ICON: Record<string, string> = {
  application_submitted: "📋",
  application_status: "✅",
  invite_sent: "✉️",
  invite_accepted: "🎉",
  job_posted: "💼",
  system: "📣",
};

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { toggleTheme, mode } = useTheme();
  const { token } = theme.useToken();
  const isDark = mode === "dark";
  const { active: delegatedActive, exitDelegation } = useDelegatedContextStore();

  // ✨ [ตรวจสอบ scroll position เพื่อเปลี่ยนเป็น Floating Pill Navbar]
  const [scrolled, setScrolled] = useState(false);
  // ✨ [Modal แจ้งเตือนให้ EMPLOYER สร้างโปรไฟล์โรงเรียนก่อน]
  const [showProfileModal, setShowProfileModal] = useState(false);
  // ✨ [Delegated schools จาก DB]
  const [delegatedSchools, setDelegatedSchools] = useState<DelegatedSchool[]>(
    [],
  );
  // ✨ [Notifications]
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [previewNotif, setPreviewNotif] = useState<AppNotification | null>(null);

  // ✨ ตรวจสอบว่า EMPLOYER มี SchoolProfile แล้วหรือยัง ก่อนเข้าหน้าที่ต้องการ school data
  const handleEmployerNavClick = (href: string) => (e: React.MouseEvent) => {
    // ✨ ถ้ากำลัง delegate อยู่ → มี schoolProfile จากโรงเรียนอื่นแล้ว ข้ามได้เลย
    if (user?.role === "EMPLOYER" && !user.school_name && !delegatedActive) {
      e.preventDefault();
      setShowProfileModal(true);
      return;
    }
    router.push(href);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ✨ ดึง delegated access เฉพาะ EMPLOYER — EMPLOYEE ไม่มีสิทธิ์ Delegate
  useEffect(() => {
    if (!user?.user_id || user.role !== "EMPLOYER") return;
    axios
      .get(`/api/v1/employer/organization/delegated?user_id=${user.user_id}`)
      .then((res) => {
        if (res.data.status_code === 200 && Array.isArray(res.data.data)) {
          setDelegatedSchools(res.data.data);
        }
      })
      .catch(() => {
        /* ไม่แสดง error บน Navbar */
      });
  }, [user?.user_id, user?.role]);

  // ✨ ดึง notifications + unread count — เฉพาะเมื่อ login แล้ว
  const fetchNotifications = () => {
    if (!user?.user_id) return;
    axios
      .get<{
        status_code: number;
        data: { notifications: AppNotification[]; unreadCount: number };
      }>(`/api/v1/notifications/read?user_id=${user.user_id}`)
      .then((res) => {
        if (res.data.status_code === 200) {
          setNotifications(res.data.data.notifications);
          setUnreadCount(res.data.data.unreadCount);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    // ✨ polling ทุก 30 วินาทีเพื่ออัปเดต badge โดยไม่ต้อง refresh
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  // ✨ mark อ่านแล้ว + refresh list
  const handleMarkRead = (notifId: string) => {
    if (!user?.user_id) return;
    axios
      .patch(`/api/v1/notifications/read?user_id=${user.user_id}&id=${notifId}`)
      .then(() => fetchNotifications())
      .catch(() => {});
  };

  // ✨ mark ทั้งหมดว่าอ่านแล้ว
  const handleMarkAllRead = () => {
    if (!user?.user_id) return;
    axios
      .patch(`/api/v1/notifications/read-all?user_id=${user.user_id}`)
      .then(() => fetchNotifications())
      .catch(() => {});
  };

  // ✨ Notification dropdown panel
  const notificationDropdown = (
    <div
      style={{
        width: 360,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${token.colorBorderSecondary}`,
        backgroundColor: token.colorBgContainer,
        boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
      }}
    >
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex align="center" gap={8}>
          <BellOutlined style={{ color: token.colorPrimary, fontSize: 15 }} />
          <Text strong style={{ fontSize: 14 }}>
            การแจ้งเตือน
          </Text>
          {unreadCount > 0 && (
            <Badge
              count={unreadCount}
              size="small"
              color={token.colorPrimary}
            />
          )}
        </Flex>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllRead}
            style={{
              fontSize: 12,
              padding: 0,
              color: token.colorTextSecondary,
            }}
          >
            อ่านทั้งหมด
          </Button>
        )}
      </Flex>

      {/* List */}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <Flex
            vertical
            align="center"
            justify="center"
            style={{ padding: "40px 0" }}
            gap={8}
          >
            <BellOutlined
              style={{ fontSize: 28, color: token.colorTextQuaternary }}
            />
            <Text type="secondary" style={{ fontSize: 13 }}>
              ยังไม่มีการแจ้งเตือน
            </Text>
          </Flex>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.isRead) handleMarkRead(n.id);
                setPreviewNotif(n);
                setNotifOpen(false);
              }}
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                backgroundColor: n.isRead ? "transparent" : token.colorInfoBg,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  n.isRead ? token.colorFillQuaternary : token.colorInfoBg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  n.isRead ? "transparent" : token.colorInfoBg;
              }}
            >
              <Flex gap={10} align="flex-start">
                {/* ✨ Thumbnail รูปภาพ หรือ emoji icon */}
                {n.imageUrl ? (
                  <img
                    src={n.imageUrl}
                    alt=""
                    style={{
                      width: 44,
                      height: 44,
                      objectFit: "cover",
                      borderRadius: 10,
                      flexShrink: 0,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: n.isRead
                        ? token.colorBgLayout
                        : token.colorPrimaryBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {NOTIF_ICON[n.type] ?? "🔔"}
                  </div>
                )}
                <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" justify="space-between" gap={4}>
                    <Text
                      strong={!n.isRead}
                      style={{
                        fontSize: 13,
                        color: n.isRead
                          ? token.colorTextSecondary
                          : token.colorText,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.title}
                    </Text>
                    {!n.isRead && (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: token.colorPrimary,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Flex>
                  {n.message && (
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {n.message}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>
                    {new Date(n.createdAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </Flex>
              </Flex>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const userMenuItems = [
    {
      key: "profile",
      label: user?.role === "EMPLOYER" ? "โปรไฟล์โรงเรียน" : "โปรไฟล์ของฉัน",
      icon: <UserOutlined />,
      onClick: () => {
        if (user?.role === "EMPLOYER") {
          router.push("/pages/employer/profile");
        } else {
          router.push("/pages/employee/profile/");
        }
      },
    },
    {
      key: "account-settings",
      label: "ตั้งค่าบัญชี",
      icon: <SettingOutlined />,
      onClick: () => {
        if (user?.role === "EMPLOYER") {
          router.push("/pages/employer/account-setting");
        } else {
          router.push("/pages/employee/account-setting");
        }
      },
    },
    // ✨ [Delegated Access — แสดงเสมอสำหรับ EMPLOYER]
    ...(user?.role === "EMPLOYER"
      ? [
          {
            key: "delegated-access",
            label: (
              <Flex align="center" justify="space-between" gap={8}>
                <span>การเข้าถึงที่ได้รับมอบ</span>
                {delegatedSchools.length > 0 && (
                  <Badge
                    count={delegatedSchools.length}
                    size="small"
                    color={token.colorPrimary}
                  />
                )}
              </Flex>
            ),
            icon: <KeyOutlined />,
            onClick: () => router.push("/pages/employer/delegated-access"),
          },
        ]
      : []),
    { type: "divider" as const },
    {
      key: "logout",
      label: "ออกจากระบบ",
      icon: <LogoutOutlined />,
      onClick: () => {
        logout();
        router.push("/");
        router.refresh();
      },
      danger: true,
    },
  ];

  // ─── Dropdown items สำหรับ "เข้าถึงในฐานะ" — ดึงจาก DB จริง ──────────────
  const delegatedDropdownItems = [
    {
      key: "header",
      type: "group" as const,
      label: (
        <Flex align="center" gap={6}>
          <SwapOutlined
            style={{ color: token.colorTextSecondary, fontSize: 12 }}
          />
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            เข้าถึงในฐานะ
          </Text>
        </Flex>
      ),
      children: delegatedSchools.map((item) => ({
        key: item.id,
        label: (
          <Flex align="center" gap={10} style={{ padding: "2px 0" }}>
            <Avatar
              size={28}
              src={item.schoolProfile.logoUrl || undefined}
              style={{
                backgroundColor: item.role.color || token.colorPrimary,
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {!item.schoolProfile.logoUrl &&
                item.schoolProfile.schoolName?.charAt(0)}
            </Avatar>
            <Flex vertical gap={1}>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>
                {item.schoolProfile.schoolName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {item.role.name}
              </Text>
            </Flex>
          </Flex>
        ),
        onClick: () => {
          // ✨ บันทึก delegated context → redirect ไปหน้า job/read ของโรงเรียนนั้น
          const { enterDelegation } = useDelegatedContextStore.getState();
          enterDelegation({
            orgMemberId: item.id,
            schoolProfileId: item.schoolProfile.id,
            schoolName: item.schoolProfile.schoolName,
            schoolLogoUrl: item.schoolProfile.logoUrl,
            roleName: item.role.name,
            roleColor: item.role.color,
            permissions: item.role.permissions.map((p) => p.permissionKey),
          });
          router.push("/pages/employer/job/read");
        },
      })),
    },
    { type: "divider" as const },
    {
      key: "view-all",
      label: (
        <Flex align="center" gap={6}>
          <KeyOutlined style={{ fontSize: 12 }} />
          <Text style={{ fontSize: 13 }}>ดูสิทธิ์ทั้งหมด</Text>
        </Flex>
      ),
      onClick: () => router.push("/pages/employer/delegated-access"),
    },
  ];

  return (
    <>
    {/* ── Modal บังคับสร้างโปรไฟล์โรงเรียนก่อน ── */}
    <Modal
      open={showProfileModal}
      onCancel={() => setShowProfileModal(false)}
      footer={[
        <Button key="cancel" onClick={() => setShowProfileModal(false)}>
          ยกเลิก
        </Button>,
        <Button
          key="go"
          type="primary"
          onClick={() => {
            setShowProfileModal(false);
            router.push("/pages/employer/profile");
          }}
        >
          ไปตั้งค่าโปรไฟล์โรงเรียน
        </Button>,
      ]}
      centered
      width={420}
      title={
        <Flex align="center" gap={10}>
          <ExclamationCircleOutlined style={{ color: "#faad14", fontSize: 20 }} />
          <span>ยังไม่ได้ตั้งค่าโปรไฟล์โรงเรียน</span>
        </Flex>
      }
    >
      <Flex vertical gap={8} style={{ padding: "8px 0" }}>
        <Typography.Text>
          กรุณาตั้งค่าโปรไฟล์โรงเรียนให้ครบถ้วนก่อน จึงจะสามารถลงประกาศงานและจัดการงานได้
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          ระบบต้องการข้อมูลพื้นฐานของโรงเรียน เช่น ชื่อโรงเรียน จังหวัด เพื่อแสดงในประกาศงาน
        </Typography.Text>
      </Flex>
    </Modal>

    {/* ── Notification Preview Modal ── */}
    <Modal
      open={!!previewNotif}
      onCancel={() => setPreviewNotif(null)}
      footer={
        <Button type="primary" onClick={() => setPreviewNotif(null)} style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}>
          ปิด
        </Button>
      }
      width={520}
      centered
      title={
        <Flex align="center" gap={8}>
          <div style={{ fontSize: 20 }}>{NOTIF_ICON[previewNotif?.type ?? ""] ?? "🔔"}</div>
          <Text strong style={{ fontSize: 15 }}>{previewNotif?.title}</Text>
        </Flex>
      }
    >
      {previewNotif && (
        <Flex vertical gap={0} style={{ marginTop: 4 }}>
          {/* รูปภาพ */}
          {previewNotif.imageUrl && (
            <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
              <img
                src={previewNotif.imageUrl}
                alt="announcement"
                style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          {/* เนื้อหา */}
          {previewNotif.message && (
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 12,
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderLeft: `4px solid ${token.colorPrimary}`,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {previewNotif.message}
              </Text>
            </div>
          )}

          {/* เวลา */}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(previewNotif.createdAt).toLocaleDateString("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Flex>
      )}
    </Modal>

    {/* ✨ [Delegated Context Banner — แสดงเมื่อกำลังทำงานแทนโรงเรียนอื่น] */}
    {delegatedActive && (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          background: `linear-gradient(90deg, #f59e0b, #fbbf24)`,
          padding: "6px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Flex align="center" gap={8}>
          <SwapOutlined style={{ color: "#fff", fontSize: 14 }} />
          <Text style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>
            กำลังทำงานในฐานะ{" "}
            <span style={{ fontWeight: 700 }}>{delegatedActive.roleName}</span>
            {" "}ของ{" "}
            <span style={{ fontWeight: 700 }}>{delegatedActive.schoolName}</span>
          </Text>
        </Flex>
        <Button
          size="small"
          onClick={() => {
            exitDelegation();
            router.push("/pages/employer/delegated-access");
          }}
          style={{
            background: "rgba(255,255,255,0.25)",
            border: "1px solid rgba(255,255,255,0.5)",
            color: "#fff",
            fontSize: 12,
            height: 26,
          }}
        >
          ออกจากการเข้าถึง
        </Button>
      </div>
    )}

    {/* ✨ [Outer wrapper — fixed full-width, จัด layout ให้ pill ลอยตรงกลาง] */}
    <div
      style={{
        position: "fixed",
        top: delegatedActive ? 36 : 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: scrolled ? "12px 24px" : "0",
        transition: "padding 0.4s cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: scrolled ? "860px" : "100%",
          margin: "0 auto",
          pointerEvents: "auto",

          // ── Pill shape เมื่อ scroll ──
          borderRadius: scrolled ? "100px" : "0px",
          padding: scrolled ? "8px 20px" : "12px 60px",

          // ── Background ──
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          backgroundColor: scrolled
            ? isDark
              ? "rgba(10, 15, 30, 0.82)"
              : "rgba(255, 255, 255, 0.82)"
            : isDark
              ? "rgba(10, 15, 30, 0.70)"
              : "rgba(255, 255, 255, 0.70)",

          // ── Border — ใช้แยก 4 ด้านเพื่อหลีกเลี่ยง shorthand conflict ──
          borderTopWidth: scrolled ? "1px" : "0px",
          borderRightWidth: scrolled ? "1px" : "0px",
          borderBottomWidth: "1px",
          borderLeftWidth: scrolled ? "1px" : "0px",
          borderStyle: "solid",
          borderColor: scrolled
            ? isDark
              ? "rgba(255,255,255,0.10)"
              : "rgba(17,182,245,0.20)"
            : token.colorBorderSecondary,

          // ── Shadow — เหมือน Dynamic Island ──
          boxShadow: scrolled
            ? isDark
              ? "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "0 8px 32px rgba(17,182,245,0.15), 0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)"
            : "none",

          // ── Transition ──
          transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",

          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <Space size="small">
            <Card
              size="small"
              variant="borderless"
              style={{
                width: scrolled ? "30px" : "36px",
                height: scrolled ? "30px" : "36px",
                padding: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: scrolled ? "50%" : "10px",
                backgroundColor: token.colorPrimary,
                transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
                flexShrink: 0,
              }}
            >
              <Text
                strong
                style={{
                  fontSize: scrolled ? "14px" : "18px",
                  lineHeight: 1,
                  color: "#fff",
                  transition: "font-size 0.4s ease",
                }}
              >
                S
              </Text>
            </Card>
            {/* ซ่อน wordmark เมื่อ scrolled เพื่อประหยัดพื้นที่ pill */}
            <div
              style={{
                maxWidth: scrolled ? "0px" : "200px",
                overflow: "hidden",
                transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1)",
                whiteSpace: "nowrap",
              }}
            >
              <Text
                strong
                style={{
                  fontSize: "18px",
                  letterSpacing: "-0.5px",
                  color: token.colorText,
                  paddingLeft: 4,
                }}
              >
                SCHOOL <span style={{ color: token.colorPrimary }}>BOARD</span>
              </Text>
            </div>
          </Space>
        </Link>

        {/* Nav Links */}
        <Space
          size={scrolled ? 20 : 32}
          style={{ transition: "gap 0.4s ease" }}
        >
          {(!user || user.role === "EMPLOYEE") && (
            <>
              <Link href="/pages/job" style={{ textDecoration: "none" }}>
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  ค้นหางาน
                </Text>
              </Link>
              {/* ✨ [ฝากประวัติ: ต้อง login ก่อน — พาไปหน้า signin พร้อม callback] */}
              <Text
                strong
                style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                onClick={() => {
                  if (user) {
                    router.push("/pages/employee/profile");
                  } else {
                    router.push(
                      "/pages/signin?redirect=%2Fpages%2Femployee%2Fprofile",
                    );
                  }
                }}
              >
                ฝากประวัติ
              </Text>
              <Link
                href="/pages/employee/school"
                style={{ textDecoration: "none" }}
              >
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  โรงเรียน
                </Text>
              </Link>
              {user && (
                <Link
                  href="/pages/employee/applications"
                  style={{ textDecoration: "none" }}
                >
                  <Text
                    strong
                    style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                  >
                    ใบสมัครงาน
                  </Text>
                </Link>
              )}
              <Link href="/pages/blog" style={{ textDecoration: "none" }}>
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  บทความ
                </Text>
              </Link>
            </>
          )}

          {user && user.role === "EMPLOYER" && (
            <>
              <a
                href="/pages/employer/job/read"
                style={{ textDecoration: "none" }}
                onClick={handleEmployerNavClick("/pages/employer/job/read")}
              >
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  งานของฉัน
                </Text>
              </a>
              <a
                href="/pages/employer/job/post"
                style={{ textDecoration: "none" }}
                onClick={handleEmployerNavClick("/pages/employer/job/post")}
              >
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  ประกาศงาน
                </Text>
              </a>
              <Link
                href="/pages/employer/school-management"
                style={{ textDecoration: "none" }}
              >
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  จัดการโรงเรียน
                </Text>
              </Link>

              {/* ✨ [Delegated Access Dropdown — เข้าถึงในฐานะโรงเรียนอื่น] */}
              {delegatedSchools.length > 0 && (
                <Dropdown
                  menu={{ items: delegatedDropdownItems }}
                  placement="bottom"
                  trigger={["click"]}
                >
                  <Flex align="center" gap={5} style={{ cursor: "pointer" }}>
                    <SwapOutlined
                      style={{
                        fontSize: scrolled ? 12 : 13,
                        color: token.colorPrimary,
                      }}
                    />
                    <Text
                      strong
                      style={{
                        fontSize: scrolled ? 13 : 14,
                        color: token.colorPrimary,
                      }}
                    >
                      เข้าถึงในฐานะ
                    </Text>
                    <Badge
                      count={delegatedSchools.length}
                      size="small"
                      color={token.colorPrimary}
                      offset={[0, 0]}
                    />
                    <CaretDownOutlined
                      style={{ fontSize: 10, color: token.colorTextTertiary }}
                    />
                  </Flex>
                </Dropdown>
              )}

              <Link
                href="/pages/employer/profile"
                style={{ textDecoration: "none" }}
              >
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  จัดการโปรไฟล์โรงเรียน
                </Text>
              </Link>
              <Link href="/pages/blog" style={{ textDecoration: "none" }}>
                <Text
                  strong
                  style={{ cursor: "pointer", fontSize: scrolled ? 13 : 14 }}
                >
                  บทความ
                </Text>
              </Link>
            </>
          )}
        </Space>

        {/* Right actions */}
        <Space size={8} style={{ flexShrink: 0 }}>
          {/* ✨ [Notification Bell — แสดงเฉพาะ login แล้ว] */}
          {user && (
            <Dropdown
              open={notifOpen}
              onOpenChange={(v) => {
                setNotifOpen(v);
                if (v) fetchNotifications();
              }}
              popupRender={() => notificationDropdown}
              placement="bottomRight"
              trigger={["click"]}
            >
              <Tooltip title="การแจ้งเตือน">
                <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                  <Button
                    type="text"
                    shape="circle"
                    icon={<BellOutlined />}
                    size={scrolled ? "small" : "middle"}
                    style={{ fontSize: "16px" }}
                  />
                </Badge>
              </Tooltip>
            </Dropdown>
          )}

          {/* ✨ [Dark Mode Toggle] */}
          <Tooltip title={mode === "dark" ? "Light Mode" : "Dark Mode"}>
            <Button
              type="text"
              shape="circle"
              icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              size={scrolled ? "small" : "middle"}
              style={{ fontSize: "16px" }}
            />
          </Tooltip>

          {user ? (
            <>
              {/* ✨ [แสดง user info เมื่อ login แล้ว — ย่อเมื่อ scrolled] */}
              <div
                style={{
                  maxWidth: scrolled ? "0px" : "220px",
                  overflow: "hidden",
                  transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1)",
                  whiteSpace: "nowrap",
                }}
              >
                <Flex align="center" gap={10} style={{ paddingRight: 8 }}>
                  <Avatar
                    size={32}
                    src={user.profile_image_url || undefined}
                    style={{ backgroundColor: token.colorPrimary }}
                  >
                    {!user.profile_image_url &&
                      user.full_name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Flex vertical gap={0}>
                    <Text strong style={{ fontSize: 13 }}>
                      {user.full_name}
                    </Text>
                    {/* ✨ EMPLOYER: แสดงชื่อโรงเรียน / EMPLOYEE: แสดง role / ADMIN: ผู้ดูแลระบบ */}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {user.role === "EMPLOYER"
                        ? user.school_name || "โรงเรียน"
                        : user.role === "EMPLOYEE"
                          ? delegatedSchools.length > 0
                            ? delegatedSchools[0].schoolProfile.schoolName
                            : "ครูผู้สอน"
                          : "ผู้ดูแลระบบ"}
                    </Text>
                  </Flex>
                </Flex>
              </div>

              {/* ✨ [Avatar icon เมื่อ scrolled] */}
              {scrolled && (
                <Avatar
                  size={32}
                  src={user.profile_image_url || undefined}
                  style={{
                    backgroundColor: token.colorPrimary,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {!user.profile_image_url &&
                    user.full_name.charAt(0).toUpperCase()}
                </Avatar>
              )}

              {/* ✨ [Dropdown menu] */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Button
                  type="text"
                  shape="circle"
                  icon={<UserOutlined />}
                  size={scrolled ? "small" : "middle"}
                />
              </Dropdown>
            </>
          ) : (
            <>
              {/* ✨ [signin/signup — ย่อเมื่อ scrolled] */}
              <div
                style={{
                  maxWidth: scrolled ? "0px" : "140px",
                  overflow: "hidden",
                  transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1)",
                  whiteSpace: "nowrap",
                }}
              >
                <Link href="/pages/signin">
                  <Button
                    type="text"
                    icon={<UserOutlined />}
                    style={{ fontWeight: 600 }}
                  >
                    เข้าสู่ระบบ
                  </Button>
                </Link>
              </div>
              <Link href="/pages/signup">
                <Button
                  type="primary"
                  shape="round"
                  icon={<SolutionOutlined />}
                  size={scrolled ? "small" : "middle"}
                  style={{
                    height: scrolled ? "32px" : "40px",
                    padding: scrolled ? "0 14px" : "0 20px",
                    fontWeight: 600,
                    fontSize: scrolled ? 12 : 14,
                    transition: "all 0.4s ease",
                  }}
                >
                  สมัครสมาชิก
                </Button>
              </Link>
            </>
          )}
        </Space>
      </div>
    </div>
    </>
  );
}
