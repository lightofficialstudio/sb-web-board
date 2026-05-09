"use client";

import { useAuthStore } from "@/app/stores/auth-store";
import {
  ApartmentOutlined,
  BankOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Input,
  Row,
  Select,
  Skeleton,
  Tag,
  Timeline,
  Typography,
  notification,
  theme,
} from "antd";
import Link from "next/link";
import { useDelegatedContextStore } from "@/app/stores/delegated-context-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DelegatedAccess } from "./_state/delegated-store";
import { useDelegatedStore } from "./_state/delegated-store";

const { Title, Text } = Typography;
const PRIMARY = "#11b6f5";

// ─── Permission label map ─────────────────────────────────────────────────────

const RESOURCE_LABEL: Record<string, string> = {
  jobs: "ประกาศงาน",
  applicants: "ผู้สมัคร",
  profile: "โปรไฟล์โรงเรียน",
  members: "จัดการสมาชิก",
  analytics: "สถิติ & รายงาน",
  settings: "ตั้งค่าระบบ",
};

const ACTION_LABEL: Record<string, string> = {
  view: "ดู",
  create: "สร้าง",
  edit: "แก้ไข",
  delete: "ลบ",
  export: "ส่งออก",
  manage: "จัดการ",
};

const RESOURCE_ICON: Record<string, React.ReactNode> = {
  jobs: <FileTextOutlined />,
  applicants: <TeamOutlined />,
  profile: <BankOutlined />,
  members: <ApartmentOutlined />,
  analytics: <BarChartOutlined />,
  settings: <SettingOutlined />,
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  owner: <CheckCircleFilled style={{ color: "#F59E0B" }} />,
  admin: <SafetyCertificateOutlined />,
  hr_manager: <TeamOutlined />,
  staff: <UserOutlined />,
  recruiter: <SearchOutlined />,
};

const STATUS_CONFIG = {
  ACTIVE: { label: "ใช้งานได้", badgeStatus: "success" as const },
  PENDING: { label: "รอยืนยัน", badgeStatus: "processing" as const },
  INACTIVE: { label: "ไม่ใช้งาน", badgeStatus: "default" as const },
};

// ─── ฟังก์ชัน helper ──────────────────────────────────────────────────────────

// จัดกลุ่ม permissionKeys → { resource → actions[] }
const groupPermissions = (
  keys: string[],
): { resource: string; actions: string[] }[] => {
  const map: Record<string, string[]> = {};
  keys.forEach((key) => {
    const [resource, action] = key.split(":");
    if (!map[resource]) map[resource] = [];
    map[resource].push(action);
  });
  return Object.entries(map).map(([resource, actions]) => ({
    resource,
    actions,
  }));
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────

const AccessDetailDrawer = ({
  access,
  open,
  onClose,
  onEnter,
}: {
  access: DelegatedAccess | null;
  open: boolean;
  onClose: () => void;
  onEnter: (access: DelegatedAccess) => void;
}) => {
  const { token } = theme.useToken();
  if (!access) return null;

  const status = STATUS_CONFIG[access.status] ?? STATUS_CONFIG.INACTIVE;
  const canEnter = access.status === "ACTIVE";
  const permGroups = groupPermissions(
    access.role.permissions.map((p) => p.permissionKey),
  );
  const daysLeft = access.schoolProfile.profile ? null : null; // expiresAt ไม่มีใน OrgMember — แสดง joinedAt แทน

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={
        <Flex align="center" gap={12}>
          <Avatar
            size={40}
            src={access.schoolProfile.logoUrl ?? undefined}
            style={{
              backgroundColor: access.role.color,
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {access.schoolProfile.schoolName.charAt(0)}
          </Avatar>
          <Flex vertical gap={2}>
            <Text strong style={{ fontSize: 15 }}>
              {access.schoolProfile.schoolName}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {access.schoolProfile.province}
            </Text>
          </Flex>
        </Flex>
      }
      footer={
        <Flex justify="space-between" align="center">
          <Button onClick={onClose}>ปิด</Button>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            disabled={!canEnter}
            onClick={() => {
              onEnter(access);
              onClose();
            }}
            size="large"
            style={{ minWidth: 160 }}
          >
            เข้าถึงในฐานะ {access.role.name}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={20}>
        {access.status === "PENDING" && (
          <Alert
            message="รอการยืนยัน"
            description="สิทธิ์นี้อยู่ระหว่างรอการเปิดใช้งาน"
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
          />
        )}

        <Card
          variant="borderless"
          style={{
            borderRadius: 12,
            backgroundColor: token.colorFillQuaternary,
          }}
        >
          <Descriptions
            column={1}
            size="small"
            styles={{ label: { width: 130 } }}
          >
            <Descriptions.Item label="บทบาท">
              <Flex align="center" gap={6}>
                <span style={{ color: access.role.color }}>
                  {ROLE_ICON[access.role.slug] ?? <UserOutlined />}
                </span>
                <Text strong>{access.role.name}</Text>
              </Flex>
            </Descriptions.Item>
            <Descriptions.Item label="สถานะ">
              <Badge status={status.badgeStatus} text={status.label} />
            </Descriptions.Item>
            <Descriptions.Item label="ให้สิทธิ์โดย">
              <Text>
                {access.inviter
                  ? `${access.inviter.firstName ?? ""} ${access.inviter.lastName ?? ""}`.trim() ||
                    access.schoolProfile.profile.email
                  : "-"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="เข้าร่วมเมื่อ">
              {access.joinedAt
                ? new Date(access.joinedAt).toLocaleDateString("th-TH")
                : "-"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Flex vertical gap={12}>
          <Flex align="center" gap={6}>
            <KeyOutlined style={{ color: PRIMARY }} />
            <Text strong style={{ fontSize: 14 }}>
              สิทธิ์ที่ได้รับ ({access.role.permissions.length} permissions)
            </Text>
          </Flex>
          {permGroups.map((grp) => (
            <Flex key={grp.resource} vertical gap={6}>
              <Flex align="center" gap={6}>
                <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                  {RESOURCE_ICON[grp.resource] ?? <LockOutlined />}
                </span>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {RESOURCE_LABEL[grp.resource] ?? grp.resource}
                </Text>
              </Flex>
              <Flex wrap="wrap" gap={4} style={{ paddingLeft: 20 }}>
                {grp.actions.map((a) => (
                  <Tag key={a} style={{ fontSize: 11, margin: 0 }}>
                    {ACTION_LABEL[a] ?? a}
                  </Tag>
                ))}
              </Flex>
            </Flex>
          ))}
        </Flex>

        <Divider />

        <Flex vertical gap={10}>
          <Flex align="center" gap={6}>
            <CalendarOutlined style={{ color: PRIMARY }} />
            <Text strong style={{ fontSize: 14 }}>
              ประวัติ
            </Text>
          </Flex>
          <Timeline
            items={[
              {
                dot: <CheckCircleOutlined style={{ color: "#10B981" }} />,
                children: (
                  <Flex vertical gap={2}>
                    <Text style={{ fontSize: 13 }}>
                      ได้รับสิทธิ์ Role: {access.role.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(access.createdAt).toLocaleDateString("th-TH")}
                    </Text>
                  </Flex>
                ),
              },
              ...(access.joinedAt
                ? [
                    {
                      dot: <LoginOutlined style={{ color: PRIMARY }} />,
                      children: (
                        <Flex vertical gap={2}>
                          <Text style={{ fontSize: 13 }}>เข้าร่วมองค์กร</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(access.joinedAt).toLocaleDateString(
                              "th-TH",
                            )}
                          </Text>
                        </Flex>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Flex>
      </Flex>
    </Drawer>
  );
};

// ─── Access Card ──────────────────────────────────────────────────────────────

const AccessCard = ({
  access,
  onViewDetail,
  onEnter,
}: {
  access: DelegatedAccess;
  onViewDetail: (a: DelegatedAccess) => void;
  onEnter: (a: DelegatedAccess) => void;
}) => {
  const { token } = theme.useToken();
  const status = STATUS_CONFIG[access.status] ?? STATUS_CONFIG.INACTIVE;
  const canEnter = access.status === "ACTIVE";
  const permCount = access.role.permissions.length;
  const permGroups = groupPermissions(
    access.role.permissions.map((p) => p.permissionKey),
  );

  return (
    <Card
      variant="borderless"
      style={{
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        opacity: access.status === "INACTIVE" ? 0.65 : 1,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          height: 4,
          borderRadius: "14px 14px 0 0",
          background: canEnter
            ? `linear-gradient(90deg, ${access.role.color} 0%, ${access.role.color}88 100%)`
            : token.colorFillSecondary,
        }}
      />
      <Flex vertical gap={0} style={{ padding: "16px 20px 20px" }}>
        <Flex align="flex-start" justify="space-between" gap={12}>
          <Flex align="center" gap={12}>
            <Avatar
              size={48}
              src={access.schoolProfile.logoUrl ?? undefined}
              style={{
                backgroundColor: access.role.color,
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {access.schoolProfile.schoolName.charAt(0)}
            </Avatar>
            <Flex vertical gap={3}>
              <Text strong style={{ fontSize: 15 }}>
                {access.schoolProfile.schoolName}
              </Text>
              <Flex align="center" gap={6}>
                {access.schoolProfile.schoolType && (
                  <Tag style={{ fontSize: 11, margin: 0 }}>
                    {access.schoolProfile.schoolType}
                  </Tag>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {access.schoolProfile.province}
                </Text>
              </Flex>
            </Flex>
          </Flex>
          <Badge status={status.badgeStatus} text={status.label} />
        </Flex>

        <Divider style={{ margin: "14px 0" }} />

        <Flex vertical gap={10}>
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={6}>
              <span style={{ color: access.role.color, fontSize: 14 }}>
                {ROLE_ICON[access.role.slug] ?? <UserOutlined />}
              </span>
              <Text strong style={{ fontSize: 13 }}>
                {access.role.name}
              </Text>
            </Flex>
            <Flex align="center" gap={4}>
              <KeyOutlined
                style={{ fontSize: 11, color: token.colorTextQuaternary }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {permCount} permissions
              </Text>
            </Flex>
          </Flex>

          <Flex wrap="wrap" gap={4}>
            {permGroups.map((grp) => (
              <Tag
                key={grp.resource}
                icon={
                  <span style={{ marginRight: 3, fontSize: 11 }}>
                    {RESOURCE_ICON[grp.resource]}
                  </span>
                }
                style={{
                  fontSize: 11,
                  margin: 0,
                  color: token.colorTextSecondary,
                }}
              >
                {RESOURCE_LABEL[grp.resource] ?? grp.resource}
              </Tag>
            ))}
          </Flex>

          <Flex align="center" gap={4}>
            <UserOutlined
              style={{ fontSize: 11, color: token.colorTextQuaternary }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {access.inviter
                ? `ให้สิทธิ์โดย ${[access.inviter.firstName, access.inviter.lastName].filter(Boolean).join(" ")}`
                : `จาก ${access.schoolProfile.schoolName}`}
            </Text>
          </Flex>
        </Flex>

        <Divider style={{ margin: "14px 0" }} />

        <Flex justify="space-between" align="center">
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => onViewDetail(access)}
            style={{ color: token.colorTextSecondary, fontSize: 12 }}
          >
            รายละเอียด
          </Button>
          <Button
            type={canEnter ? "primary" : "default"}
            size="small"
            icon={<LoginOutlined />}
            disabled={!canEnter}
            onClick={() => canEnter && onEnter(access)}
            style={{ minWidth: 140 }}
          >
            {canEnter ? `เข้าถึงในฐานะ ${access.role.name}` : status.label}
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DelegatedAccessPage() {
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [notifApi, contextHolder] = notification.useNotification();

  const { accesses, isLoading, fetchAccesses } = useDelegatedStore();
  const { enterDelegation } = useDelegatedContextStore();

  const [isMounted, setIsMounted] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "PENDING" | "INACTIVE"
  >("ALL");
  const [search, setSearch] = useState("");
  const [detailAccess, setDetailAccess] = useState<DelegatedAccess | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isMounted) return;
    if (!isAuthenticated || !user) {
      router.replace(
        "/pages/signin?redirect=%2Fpages%2Femployer%2Fdelegated-access",
      );
      return;
    }
    fetchAccesses(user.user_id);
  }, [isMounted, isAuthenticated, user?.user_id]);

  if (!isMounted) return null;

  // ─── Enter handler ─────────────────────────────────────────────────────────

  const handleEnter = (access: DelegatedAccess) => {
    modal.confirm({
      title: `เข้าถึงในฐานะ ${access.role.name}`,
      icon: <SwapOutlined style={{ color: PRIMARY }} />,
      content: (
        <Flex vertical gap={12} style={{ marginTop: 8 }}>
          <Text>คุณกำลังจะเข้าถึง</Text>
          <Flex
            align="center"
            gap={12}
            style={{
              padding: "12px 16px",
              backgroundColor: token.colorFillQuaternary,
              borderRadius: 10,
            }}
          >
            <Avatar
              size={36}
              style={{ backgroundColor: access.role.color, fontWeight: 700 }}
            >
              {access.schoolProfile.schoolName.charAt(0)}
            </Avatar>
            <Flex vertical gap={2}>
              <Text strong>{access.schoolProfile.schoolName}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                บทบาท: {access.role.name} · {access.role.permissions.length}{" "}
                permissions
              </Text>
            </Flex>
          </Flex>
          <Text type="secondary" style={{ fontSize: 13 }}>
            การกระทำทั้งหมดจะถูกบันทึกใน Audit Log ของโรงเรียน
          </Text>
        </Flex>
      ),
      okText: "เข้าถึงเลย",
      cancelText: "ยกเลิก",
      onOk: () => {
        // ✨ บันทึก delegated context ลง persisted store ก่อน redirect
        enterDelegation({
          orgMemberId: access.id,
          schoolProfileId: access.schoolProfile.id,
          schoolName: access.schoolProfile.schoolName,
          schoolLogoUrl: access.schoolProfile.logoUrl,
          roleName: access.role.name,
          roleColor: access.role.color,
          permissions: access.role.permissions.map((p) => p.permissionKey),
        });
        notifApi.success({
          message: `เข้าถึง ${access.schoolProfile.schoolName} แล้ว`,
          description: `คุณกำลังทำงานในฐานะ ${access.role.name}`,
        });
        router.push("/pages/employer/job/read");
      },
    });
  };

  // ─── Filter ────────────────────────────────────────────────────────────────

  const filtered = accesses.filter((a) => {
    const matchStatus = filterStatus === "ALL" || a.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      a.schoolProfile.schoolName.toLowerCase().includes(q) ||
      a.role.name.toLowerCase().includes(q) ||
      a.schoolProfile.province.includes(search);
    return matchStatus && matchSearch;
  });

  const activeCount = accesses.filter((a) => a.status === "ACTIVE").length;
  const pendingCount = accesses.filter((a) => a.status === "PENDING").length;
  const inactiveCount = accesses.filter((a) => a.status === "INACTIVE").length;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: token.colorBgLayout,
        paddingBottom: 80,
      }}
    >
      {contextHolder}

      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #0f2044 0%, #1a3a6b 50%, #0878a8 100%)",
          padding: "32px 0 48px",
          marginBottom: -24,
        }}
      >
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px" }}>
          <Breadcrumb
            style={{ marginBottom: 20 }}
            items={[
              {
                title: (
                  <Link href="/" style={{ color: "rgba(255,255,255,0.6)" }}>
                    หน้าแรก
                  </Link>
                ),
              },
              {
                title: (
                  <Text style={{ color: "rgba(255,255,255,0.9)" }}>
                    การเข้าถึงของผู้รับมอบสิทธิ์
                  </Text>
                ),
              },
            ]}
          />
          <Flex align="center" justify="space-between" wrap="wrap" gap={16}>
            <Flex align="center" gap={16}>
              <Flex
                align="center"
                justify="center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <KeyOutlined style={{ fontSize: 26, color: "#fff" }} />
              </Flex>
              <Flex vertical gap={4}>
                <Title level={3} style={{ color: "#fff", margin: 0 }}>
                  การเข้าถึงของผู้รับมอบสิทธิ์
                </Title>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                  รายการโรงเรียนที่คุณได้รับสิทธิ์เข้าถึงในฐานะตัวแทน (Delegated
                  Access)
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </div>
      </div>

      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px" }}>
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            {
              label: "เข้าถึงได้",
              value: activeCount,
              icon: (
                <CheckCircleOutlined
                  style={{ fontSize: 20, color: "#10B981" }}
                />
              ),
              bg: token.colorSuccessBg,
            },
            {
              label: "รอยืนยัน",
              value: pendingCount,
              icon: (
                <ClockCircleOutlined
                  style={{ fontSize: 20, color: token.colorWarning }}
                />
              ),
              bg: token.colorWarningBg,
            },
            {
              label: "ไม่ใช้งาน",
              value: inactiveCount,
              icon: (
                <CloseCircleOutlined
                  style={{ fontSize: 20, color: token.colorError }}
                />
              ),
              bg: token.colorErrorBg,
            },
            {
              label: "ทั้งหมด",
              value: accesses.length,
              icon: <BankOutlined style={{ fontSize: 20, color: PRIMARY }} />,
              bg: token.colorPrimaryBg,
            },
          ].map((c) => (
            <Col xs={12} md={6} key={c.label}>
              <Card
                variant="borderless"
                style={{
                  borderRadius: 12,
                  backgroundColor: c.bg,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
                styles={{ body: { padding: "16px 20px" } }}
              >
                <Flex align="center" gap={12}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {c.icon}
                  </Flex>
                  <Flex vertical gap={2}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {c.label}
                    </Text>
                    <Text strong style={{ fontSize: 22, lineHeight: 1 }}>
                      {c.value}
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Filter */}
        <Flex
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={12}
          style={{ marginBottom: 20 }}
        >
          <Input
            prefix={
              <SearchOutlined style={{ color: token.colorTextQuaternary }} />
            }
            placeholder="ค้นหาโรงเรียน, บทบาท, จังหวัด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320, borderRadius: 8 }}
            allowClear
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ minWidth: 160 }}
            options={[
              { value: "ALL", label: "ทุกสถานะ" },
              { value: "ACTIVE", label: "ใช้งานได้" },
              { value: "PENDING", label: "รอยืนยัน" },
              { value: "INACTIVE", label: "ไม่ใช้งาน" },
            ]}
          />
        </Flex>

        {/* Content */}
        {isLoading ? (
          <Row gutter={[20, 20]}>
            {[1, 2, 3].map((i) => (
              <Col xs={24} md={12} xl={8} key={i}>
                <Card variant="borderless" style={{ borderRadius: 14 }}>
                  <Skeleton active avatar paragraph={{ rows: 3 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : filtered.length === 0 ? (
          <Flex justify="center" align="center" style={{ padding: "80px 0" }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Flex vertical align="center" gap={8}>
                  <Text type="secondary" style={{ fontSize: 15 }}>
                    {accesses.length === 0
                      ? "คุณยังไม่ได้รับมอบสิทธิ์จากโรงเรียนใดเลย"
                      : "ไม่พบรายการที่ตรงกัน"}
                  </Text>
                </Flex>
              }
            />
          </Flex>
        ) : (
          <Row gutter={[20, 20]}>
            {filtered.map((access) => (
              <Col xs={24} md={12} xl={8} key={access.id}>
                <AccessCard
                  access={access}
                  onViewDetail={(a) => {
                    setDetailAccess(a);
                    setDrawerOpen(true);
                  }}
                  onEnter={handleEnter}
                />
              </Col>
            ))}
          </Row>
        )}

        {/* Info */}
        <Card
          variant="borderless"
          style={{
            borderRadius: 14,
            marginTop: 32,
            backgroundColor: token.colorInfoBg,
            border: `1px solid ${token.colorInfoBorder}`,
          }}
          styles={{ body: { padding: "16px 20px" } }}
        >
          <Flex align="flex-start" gap={12}>
            <InfoCircleOutlined
              style={{ color: token.colorInfo, fontSize: 16, marginTop: 2 }}
            />
            <Flex vertical gap={4}>
              <Text strong style={{ color: token.colorInfoText }}>
                Delegated Access คืออะไร?
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: token.colorInfoText,
                  lineHeight: 1.6,
                }}
              >
                เจ้าของโรงเรียนสามารถมอบสิทธิ์ให้คุณเข้าถึงระบบในฐานะตัวแทนได้
                โดยจำกัดเฉพาะสิทธิ์ที่ได้รับเท่านั้น
                การกระทำทั้งหมดจะถูกบันทึกใน Audit Log
                และเจ้าของสามารถยกเลิกสิทธิ์ได้ทุกเมื่อ
              </Text>
            </Flex>
          </Flex>
        </Card>
      </div>

      <AccessDetailDrawer
        access={detailAccess}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEnter={handleEnter}
      />
    </div>
  );
}
