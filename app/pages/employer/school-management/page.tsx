"use client";

import { SummaryCard } from "@/app/components/card/summary-card.component";
import { useAuthStore } from "@/app/stores/auth-store";
import { useDelegatedContextStore } from "@/app/stores/delegated-context-store";
import {
  BankOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  MailOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
  App,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification,
  theme,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PackageTab from "./_components/package-tab";
import { RbacTab } from "./_components/rbac-tab";
import type { OrgInvite, OrgMember } from "./_state/org-store";
import { useOrgStore } from "./_state/org-store";

const { Title, Text } = Typography;

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  owner: { label: "เจ้าของ", color: "gold", icon: <CrownOutlined /> },
  admin: {
    label: "ผู้ดูแล",
    color: "blue",
    icon: <SafetyCertificateOutlined />,
  },
  staff: { label: "เจ้าหน้าที่", color: "default", icon: <UserOutlined /> },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "ใช้งาน", color: "success" },
  PENDING: { label: "รอยืนยัน", color: "warning" },
  INACTIVE: { label: "ไม่ใช้งาน", color: "default" },
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────
const InviteModal = ({
  open,
  onClose,
  onInvite,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, roleId: string) => Promise<void>;
  roles: { id: string; name: string; slug: string; color: string }[];
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();

  const handleSubmit = async (values: { email: string; role_id: string }) => {
    setLoading(true);
    try {
      await onInvite(values.email, values.role_id);
      form.resetFields();
    } finally {
      setLoading(false);
    }
  };

  const invitableRoles = roles.filter((r) => r.slug !== "owner");

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      title={
        <Flex align="center" gap={10}>
          <Flex
            align="center"
            justify="center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `linear-gradient(135deg, #11b6f5 0%, #0878a8 100%)`,
            }}
          >
            <UserAddOutlined style={{ color: "#fff", fontSize: 16 }} />
          </Flex>
          <Flex vertical gap={1}>
            <Text strong style={{ fontSize: 15 }}>
              เชิญสมาชิกใหม่
            </Text>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              ส่งคำเชิญทางอีเมล
            </Text>
          </Flex>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label="อีเมลผู้รับเชิญ"
          name="email"
          rules={[
            {
              required: true,
              type: "email",
              message: "กรุณากรอกอีเมลที่ถูกต้อง",
            },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="email@example.com"
            size="large"
          />
        </Form.Item>

        <Form.Item
          label="บทบาท"
          name="role_id"
          rules={[{ required: true, message: "กรุณาเลือกบทบาท" }]}
        >
          <Select size="large" placeholder="เลือกบทบาท">
            {invitableRoles.map((r) => (
              <Select.Option key={r.id} value={r.id}>
                <Flex align="center" gap={8}>
                  <Flex vertical gap={0}>
                    <Text strong style={{ fontSize: 13 }}>
                      {r.name}
                    </Text>
                  </Flex>
                </Flex>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Flex
          style={{
            backgroundColor: token.colorInfoBg,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
          }}
          gap={8}
          align="flex-start"
        >
          <MailOutlined style={{ color: token.colorInfo, marginTop: 2 }} />
          <Text style={{ fontSize: 12, color: token.colorInfoText }}>
            ผู้รับจะได้รับอีเมลเชิญและต้องยืนยันภายใน 7 วัน
            ก่อนจึงจะเข้าถึงระบบได้
          </Text>
        </Flex>

        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<MailOutlined />}
            loading={loading}
          >
            ส่งคำเชิญ
          </Button>
        </Flex>
      </Form>
    </Modal>
  );
};

// ─── Edit Member Role Modal ────────────────────────────────────────────────────
const EditMemberModal = ({
  open,
  member,
  onClose,
  onSave,
  roles,
}: {
  open: boolean;
  member: OrgMember | null;
  onClose: () => void;
  onSave: (memberId: string, roleId: string) => Promise<void>;
  roles: { id: string; name: string; slug: string }[];
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    if (member) {
      form.setFieldsValue({ role_id: member.roleId });
    }
  }, [member, form]);

  if (!member) return null;

  const displayName =
    [member.profile.firstName, member.profile.lastName]
      .filter(Boolean)
      .join(" ") || member.profile.email;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      title={
        <Flex align="center" gap={10}>
          <Avatar
            size={36}
            style={{
              backgroundColor: token.colorPrimary,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0)}
          </Avatar>
          <Flex vertical gap={1}>
            <Text strong style={{ fontSize: 15 }}>
              {displayName}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {member.profile.email}
            </Text>
          </Flex>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (v) => {
          setLoading(true);
          try {
            await onSave(member.id, v.role_id);
            form.resetFields();
          } finally {
            setLoading(false);
          }
        }}
        style={{ marginTop: 16 }}
      >
        <Form.Item label="บทบาท" name="role_id" rules={[{ required: true }]}>
          <Select size="large">
            {roles
              .filter((r) => r.slug !== "owner")
              .map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.name}
                </Select.Option>
              ))}
          </Select>
        </Form.Item>

        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<EditOutlined />}
            loading={loading}
          >
            บันทึก
          </Button>
        </Flex>
      </Form>
    </Modal>
  );
};

// ─── หน้าหลัก ─────────────────────────────────────────────────────────────────
export default function SchoolManagementPage() {
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const { user, isAuthenticated } = useAuthStore();
  // ✨ ดึง delegated context — เป็น source of truth ว่ากำลังจัดการโรงเรียนไหน
  const delegatedActive = useDelegatedContextStore((s) => s.active);
  const delegatedOrgId = delegatedActive?.schoolProfileId ?? null;
  const router = useRouter();
  const [api, contextHolder] = notification.useNotification();

  const {
    members,
    invites,
    roles,
    isLoadingMembers,
    isLoadingInvites,
    isLoadingRoles,
    fetchMembers,
    fetchInvites,
    fetchRoles,
    inviteMember,
    updateMemberRole,
    removeMember,
    revokeInvite,
  } = useOrgStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<OrgMember | null>(null);
  const [activeTab, setActiveTab] = useState<
    "members" | "invites" | "rbac" | "settings" | "package"
  >("members");

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isMounted) return;
    if (!isAuthenticated || !user) {
      router.replace(
        "/pages/signin?redirect=%2Fpages%2Femployer%2Fschool-management",
      );
      return;
    }
    if (user.role !== "EMPLOYER") {
      router.replace(
        user.role === "EMPLOYEE" ? "/pages/employee/profile" : "/",
      );
      return;
    }
    // ✨ โหลดข้อมูลจาก API (ใช้ delegatedOrgId ถ้ามี delegated context)
    fetchMembers(user.user_id, delegatedOrgId);
    fetchInvites(user.user_id, delegatedOrgId);
    fetchRoles(user.user_id, delegatedOrgId);
  }, [isMounted, isAuthenticated, user?.role, delegatedOrgId]);

  if (!isMounted || !user) return null;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleInvite = async (email: string, roleId: string) => {
    try {
      await inviteMember(user.user_id, email, roleId, delegatedOrgId);
      setIsInviteOpen(false);
      api.success({ message: `ส่งคำเชิญไปยัง ${email} แล้ว` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      api.error({ message: "ไม่สามารถส่งคำเชิญได้", description: msg });
    }
  };

  const handleEditSave = async (memberId: string, roleId: string) => {
    try {
      await updateMemberRole(user.user_id, memberId, roleId, delegatedOrgId);
      setEditMember(null);
      api.success({ message: "อัปเดตบทบาทเรียบร้อยแล้ว" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      api.error({ message: "ไม่สามารถอัปเดตบทบาทได้", description: msg });
    }
  };

  const handleRemoveMember = (member: OrgMember) => {
    const displayName =
      [member.profile.firstName, member.profile.lastName]
        .filter(Boolean)
        .join(" ") || member.profile.email;
    modal.confirm({
      title: `ลบ ${displayName} ออกจากทีม?`,
      content: "สมาชิกจะสูญเสียสิทธิ์การเข้าถึงระบบทั้งหมดทันที",
      okText: "ยืนยัน ลบออก",
      cancelText: "ยกเลิก",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await removeMember(user.user_id, member.id, delegatedOrgId);
          api.success({ message: `ลบ ${displayName} ออกจากทีมแล้ว` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
          api.error({ message: "ไม่สามารถลบสมาชิกได้", description: msg });
        }
      },
    });
  };

  const handleCancelInvite = (invite: OrgInvite) => {
    modal.confirm({
      title: "ยกเลิกคำเชิญ?",
      content: `คำเชิญที่ส่งไป ${invite.email} จะถูกยกเลิก`,
      okText: "ยืนยัน",
      cancelText: "ไม่",
      onOk: async () => {
        try {
          await revokeInvite(user.user_id, invite.id, delegatedOrgId);
          api.info({ message: "ยกเลิกคำเชิญแล้ว" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
          api.error({ message: "ไม่สามารถยกเลิกคำเชิญได้", description: msg });
        }
      },
    });
  };

  const handleCopyInviteLink = (email: string) => {
    navigator.clipboard?.writeText(
      `${window.location.origin}/invite?email=${email}`,
    );
    api.success({ message: "คัดลอกลิงก์เชิญแล้ว" });
  };

  const handleRefreshInvites = () => {
    fetchInvites(user.user_id, delegatedOrgId);
    api.info({ message: "รีเฟรชคำเชิญแล้ว" });
  };

  // ─── Stats Cards ───────────────────────────────────────────────────────────
  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;
  const pendingMembers = members.filter((m) => m.status === "PENDING").length;

  const statCards = [
    {
      label: "สมาชิกทั้งหมด",
      value: members.length,
      unit: "คน",
      icon: <TeamOutlined style={{ fontSize: 20 }} />,
      color: token.colorPrimary,
    },
    {
      label: "กำลังใช้งาน",
      value: activeMembers,
      unit: "คน",
      icon: <CheckCircleFilled style={{ fontSize: 20 }} />,
      color: token.colorSuccess,
    },
    {
      label: "รอยืนยัน",
      value: pendingMembers,
      unit: "คน",
      icon: <MailOutlined style={{ fontSize: 20 }} />,
      color: token.colorWarning,
    },
    {
      label: "คำเชิญที่ส่งออก",
      value: invites.length,
      unit: "รายการ",
      icon: <KeyOutlined style={{ fontSize: 20 }} />,
      color: token.colorInfo,
    },
  ];

  // ─── Role label helper ──────────────────────────────────────────────────────
  const getRoleDisplay = (roleSlug: string) => {
    const known = ROLE_CONFIG[roleSlug];
    if (known) return known;
    return { label: roleSlug, color: "default", icon: <UserOutlined /> };
  };

  // ─── Members Table columns ─────────────────────────────────────────────────
  const memberColumns = [
    {
      title: "สมาชิก",
      key: "member",
      render: (_: unknown, record: OrgMember) => {
        const displayName =
          [record.profile.firstName, record.profile.lastName]
            .filter(Boolean)
            .join(" ") || record.profile.email;
        const isOwner = record.role.slug === "owner";
        return (
          <Flex align="center" gap={12}>
            <Avatar
              size={40}
              src={record.profile.profileImageUrl}
              style={{
                backgroundColor: token.colorPrimary,
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              {displayName.charAt(0)}
            </Avatar>
            <Flex vertical gap={2}>
              <Flex align="center" gap={6}>
                <Text strong style={{ fontSize: 14 }}>
                  {displayName}
                </Text>
                {isOwner && (
                  <CrownOutlined style={{ color: "#F59E0B", fontSize: 12 }} />
                )}
              </Flex>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.profile.email}
              </Text>
              {record.joinedAt && (
                <Text
                  style={{ fontSize: 11, color: token.colorTextQuaternary }}
                >
                  เข้าร่วม:{" "}
                  {new Date(record.joinedAt).toLocaleDateString("th-TH")}
                </Text>
              )}
            </Flex>
          </Flex>
        );
      },
    },
    {
      title: "บทบาท",
      key: "role",
      width: 150,
      render: (_: unknown, record: OrgMember) => {
        const cfg = getRoleDisplay(record.role.slug);
        return (
          <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 12 }}>
            {record.role.name}
          </Tag>
        );
      },
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: string) => {
        const cfg = STATUS_CONFIG[status] ?? {
          label: status,
          color: "default",
        };
        return (
          <Badge
            status={cfg.color as "success" | "warning" | "default"}
            text={cfg.label}
          />
        );
      },
    },
    {
      title: "สิทธิ์การใช้งาน",
      key: "permissions",
      render: (_: unknown, record: OrgMember) => (
        <Flex wrap="wrap" gap={4}>
          {record.role.permissions.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ยังไม่มีสิทธิ์
            </Text>
          ) : (
            record.role.permissions.slice(0, 4).map((p) => (
              <Tag key={p.id} style={{ fontSize: 11, margin: 0 }}>
                {p.permissionKey}
              </Tag>
            ))
          )}
          {record.role.permissions.length > 4 && (
            <Tag style={{ fontSize: 11, margin: 0 }}>
              +{record.role.permissions.length - 4}
            </Tag>
          )}
        </Flex>
      ),
    },
    {
      title: "เข้าร่วมเมื่อ",
      key: "joinedAt",
      width: 120,
      render: (_: unknown, record: OrgMember) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {record.joinedAt
            ? new Date(record.joinedAt).toLocaleDateString("th-TH")
            : "—"}
        </Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 60,
      render: (_: unknown, record: OrgMember) => {
        if (record.role.slug === "owner") return null;
        const items: MenuProps["items"] = [
          {
            key: "edit",
            icon: <EditOutlined />,
            label: "แก้ไขบทบาท",
            onClick: () => setEditMember(record),
          },
          { type: "divider" },
          {
            key: "remove",
            icon: <DeleteOutlined />,
            label: "ลบออกจากทีม",
            danger: true,
            onClick: () => handleRemoveMember(record),
          },
        ];
        return (
          <Dropdown
            menu={{ items }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        );
      },
    },
  ];

  // ─── Invites Table columns ──────────────────────────────────────────────────
  const inviteColumns = [
    {
      title: "อีเมล",
      dataIndex: "email",
      key: "email",
      render: (email: string) => (
        <Flex align="center" gap={8}>
          <Avatar
            size={32}
            icon={<MailOutlined />}
            style={{
              backgroundColor: token.colorFillSecondary,
              color: token.colorTextSecondary,
            }}
          />
          <Text strong style={{ fontSize: 14 }}>
            {email}
          </Text>
        </Flex>
      ),
    },
    {
      title: "บทบาทที่เชิญ",
      key: "role",
      width: 150,
      render: (_: unknown, record: OrgInvite) => {
        const role = roles.find((r) => r.id === record.roleId);
        if (!role) return <Tag>{record.roleId}</Tag>;
        const cfg = getRoleDisplay(role.slug);
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {role.name}
          </Tag>
        );
      },
    },
    {
      title: "ผู้ส่งเชิญ",
      key: "inviter",
      width: 150,
      render: (_: unknown, record: OrgInvite) => {
        if (!record.inviter) return <Text type="secondary">—</Text>;
        const name =
          [record.inviter.firstName, record.inviter.lastName]
            .filter(Boolean)
            .join(" ") || "—";
        return <Text style={{ fontSize: 13 }}>{name}</Text>;
      },
    },
    {
      title: "ส่งเมื่อ",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {new Date(date).toLocaleDateString("th-TH")}
        </Text>
      ),
    },
    {
      title: "หมดอายุ",
      dataIndex: "expiresAt",
      key: "expiresAt",
      width: 120,
      render: (date: string) => {
        const daysLeft = Math.ceil(
          (new Date(date).getTime() - Date.now()) / 86400000,
        );
        return (
          <Tag
            color={daysLeft <= 2 ? "red" : "orange"}
            style={{ fontSize: 11 }}
          >
            เหลือ {daysLeft} วัน
          </Tag>
        );
      },
    },
    {
      title: "",
      key: "action",
      width: 120,
      render: (_: unknown, record: OrgInvite) => (
        <Space size={4}>
          <Tooltip title="คัดลอกลิงก์เชิญ">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyInviteLink(record.email)}
            />
          </Tooltip>
          <Tooltip title="ยกเลิกคำเชิญ">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleCancelInvite(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ─── Tab Nav ────────────────────────────────────────────────────────────────
  const tabs = [
    {
      key: "members",
      label: "สมาชิกในทีม",
      icon: <TeamOutlined />,
      count: members.length,
    },
    {
      key: "invites",
      label: "คำเชิญที่รอ",
      icon: <MailOutlined />,
      count: invites.length,
    },
    {
      key: "rbac",
      label: "จัดการสิทธิ์",
      icon: (
        <KeyOutlined
          style={{
            color: activeTab === "rbac" ? token.colorPrimary : undefined,
          }}
        />
      ),
    },
    { key: "settings", label: "ตั้งค่าองค์กร", icon: <SettingOutlined /> },
    { key: "package", label: "แพ็คเกจ", icon: <CrownOutlined /> },
  ] as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: token.colorBgLayout,
        paddingBottom: 80,
      }}
    >
      {contextHolder}

      {/* ─── Hero Header ──────────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, #0f2044 0%, #1a3a6b 50%, #0878a8 100%)`,
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
                  <Link
                    href="/pages/employer"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    แดชบอร์ด
                  </Link>
                ),
              },
              {
                title: (
                  <Text style={{ color: "rgba(255,255,255,0.9)" }}>
                    จัดการโรงเรียน
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
                <BankOutlined style={{ fontSize: 26, color: "#fff" }} />
              </Flex>
              <Flex vertical gap={4}>
                <Title level={3} style={{ color: "#fff", margin: 0 }}>
                  จัดการโรงเรียน
                </Title>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                  จัดการทีมงานและสิทธิ์การเข้าถึงระบบของโรงเรียน
                </Text>
              </Flex>
            </Flex>

            <Button
              type="primary"
              size="large"
              icon={<UserAddOutlined />}
              onClick={() => setIsInviteOpen(true)}
              style={{
                background: "rgba(255,255,255,0.15)",
                borderColor: "rgba(255,255,255,0.4)",
                color: "#fff",
                backdropFilter: "blur(8px)",
              }}
            >
              เชิญสมาชิกใหม่
            </Button>
          </Flex>
        </div>
      </div>

      {/* ─── Stats Row ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px" }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {statCards.map((card) => (
            <Col xs={12} md={6} key={card.label}>
              <SummaryCard
                title={card.label}
                value={card.value}
                unit={card.unit}
                icon={card.icon}
                color={card.color}
                isLoading={isLoadingMembers || isLoadingInvites}
              />
            </Col>
          ))}
        </Row>

        {/* ─── Tab Navigation ────────────────────────────────────────── */}
        <Flex
          style={{
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            marginBottom: 20,
          }}
          gap={0}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "12px 20px",
                border: "none",
                borderBottom:
                  activeTab === tab.key
                    ? `2px solid ${token.colorPrimary}`
                    : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color:
                  activeTab === tab.key
                    ? token.colorPrimary
                    : token.colorTextSecondary,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
                marginBottom: -1,
              }}
            >
              {tab.icon}
              {tab.label}
              {"count" in tab && tab.count > 0 && (
                <span
                  style={{
                    backgroundColor:
                      activeTab === tab.key
                        ? token.colorPrimary
                        : token.colorFillSecondary,
                    color:
                      activeTab === tab.key ? "#fff" : token.colorTextSecondary,
                    borderRadius: 10,
                    padding: "0 7px",
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: "18px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </Flex>

        {/* ─── Tab: สมาชิก ───────────────────────────────────────────── */}
        {activeTab === "members" && (
          <Card
            variant="borderless"
            style={{
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
            styles={{ body: { padding: 0 } }}
            title={
              <Flex
                justify="space-between"
                align="center"
                style={{ padding: "4px 0" }}
              >
                <Flex align="center" gap={8}>
                  <TeamOutlined style={{ color: token.colorPrimary }} />
                  <Text strong style={{ fontSize: 15 }}>
                    สมาชิกในทีม
                  </Text>
                </Flex>
                <Flex gap={8}>
                  <Button
                    icon={<ReloadOutlined />}
                    size="small"
                    loading={isLoadingMembers}
                    onClick={() => fetchMembers(user.user_id)}
                  >
                    รีเฟรช
                  </Button>
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    size="small"
                    onClick={() => setIsInviteOpen(true)}
                  >
                    เชิญสมาชิก
                  </Button>
                </Flex>
              </Flex>
            }
          >
            {isLoadingMembers ? (
              <div style={{ padding: "24px" }}>
                <Skeleton active avatar paragraph={{ rows: 6 }} />
              </div>
            ) : members.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary">ยังไม่มีสมาชิกในทีมของคุณ</Text>
                }
                style={{ padding: "60px 0" }}
              >
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => setIsInviteOpen(true)}
                >
                  เชิญสมาชิกคนแรก
                </Button>
              </Empty>
            ) : (
              <Table
                columns={memberColumns}
                dataSource={members}
                rowKey="id"
                pagination={false}
              />
            )}
          </Card>
        )}

        {/* ─── Tab: คำเชิญที่รอ ──────────────────────────────────────── */}
        {activeTab === "invites" && (
          <Card
            variant="borderless"
            style={{
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
            styles={{ body: { padding: 0 } }}
            title={
              <Flex
                justify="space-between"
                align="center"
                style={{ padding: "4px 0" }}
              >
                <Flex align="center" gap={8}>
                  <MailOutlined style={{ color: "#F59E0B" }} />
                  <Text strong style={{ fontSize: 15 }}>
                    คำเชิญที่รอการตอบรับ
                  </Text>
                </Flex>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  loading={isLoadingInvites}
                  onClick={handleRefreshInvites}
                >
                  รีเฟรช
                </Button>
              </Flex>
            }
          >
            {isLoadingInvites ? (
              <div style={{ padding: "24px" }}>
                <Skeleton active paragraph={{ rows: 5 }} />
              </div>
            ) : invites.length === 0 ? (
              <Flex
                justify="center"
                align="center"
                style={{ padding: "60px 0" }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text type="secondary">ไม่มีคำเชิญที่รอการตอบรับ</Text>
                  }
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsInviteOpen(true)}
                  >
                    ส่งคำเชิญ
                  </Button>
                </Empty>
              </Flex>
            ) : (
              <Table
                columns={inviteColumns}
                dataSource={invites}
                rowKey="id"
                pagination={false}
              />
            )}
          </Card>
        )}

        {/* ─── Tab: จัดการสิทธิ์ (RBAC) ─────────────────────────────── */}
        {activeTab === "rbac" && (
          <RbacTab userId={user.user_id} delegatedOrgId={delegatedOrgId} />
        )}

        {/* ─── Tab: ตั้งค่าองค์กร ────────────────────────────────────── */}
        {activeTab === "settings" && (
          <Row gutter={[20, 20]}>
            {/* โรงเรียน */}
            <Col xs={24} lg={14}>
              <Card
                variant="borderless"
                style={{
                  borderRadius: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
                title={
                  <Flex align="center" gap={8}>
                    <BankOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>ข้อมูลองค์กร</Text>
                  </Flex>
                }
                extra={
                  <Link href="/pages/employer/profile">
                    <Button size="small" icon={<EditOutlined />}>
                      แก้ไขโปรไฟล์
                    </Button>
                  </Link>
                }
              >
                {isLoadingMembers || isLoadingRoles ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : (
                  <Descriptions
                    column={1}
                    size="small"
                    styles={{ label: { width: 140 } }}
                  >
                    <Descriptions.Item label="สมาชิกทั้งหมด">
                      <Text strong>{members.length} คน</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="บทบาทในระบบ">
                      <Flex gap={4} wrap="wrap">
                        {roles.map((r) => (
                          <Tag
                            key={r.id}
                            color={r.isSystem ? "blue" : "green"}
                            style={{ fontSize: 11 }}
                          >
                            {r.name}
                          </Tag>
                        ))}
                      </Flex>
                    </Descriptions.Item>
                    <Descriptions.Item label="คำเชิญที่รอ">
                      {invites.length} รายการ
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            </Col>

            {/* นโยบายสิทธิ์ */}
            <Col xs={24} lg={10}>
              <Card
                variant="borderless"
                style={{
                  borderRadius: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
                title={
                  <Flex align="center" gap={8}>
                    <KeyOutlined style={{ color: "#6366F1" }} />
                    <Text strong>บทบาทในองค์กร</Text>
                  </Flex>
                }
              >
                {isLoadingRoles ? (
                  <Skeleton active paragraph={{ rows: 6 }} />
                ) : (
                  <Flex vertical gap={12}>
                    {roles.map((role) => (
                      <Flex vertical gap={6} key={role.id}>
                        <Flex align="center" gap={8}>
                          <Tag
                            color={role.isSystem ? "blue" : "green"}
                            style={{ width: "fit-content" }}
                          >
                            {role.name}
                          </Tag>
                          {role.isSystem && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              System Role
                            </Text>
                          )}
                        </Flex>
                        {role.description && (
                          <Text
                            type="secondary"
                            style={{ fontSize: 12, paddingLeft: 4 }}
                          >
                            {role.description}
                          </Text>
                        )}
                        <Text
                          style={{
                            fontSize: 11,
                            color: token.colorTextQuaternary,
                            paddingLeft: 4,
                          }}
                        >
                          {role.permissions.length} permissions ·{" "}
                          {role._count.members} สมาชิก
                        </Text>
                        <Divider style={{ margin: "4px 0" }} />
                      </Flex>
                    ))}
                  </Flex>
                )}
              </Card>
            </Col>

            {/* Danger Zone */}
            <Col xs={24}>
              <Card
                variant="borderless"
                style={{
                  borderRadius: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  borderColor: token.colorErrorBorder,
                  border: `1px solid ${token.colorErrorBorder}`,
                }}
                title={
                  <Flex align="center" gap={8}>
                    <CloseCircleFilled style={{ color: token.colorError }} />
                    <Text strong style={{ color: token.colorError }}>
                      Danger Zone
                    </Text>
                  </Flex>
                }
              >
                <Flex
                  align="center"
                  justify="space-between"
                  wrap="wrap"
                  gap={12}
                >
                  <Flex vertical gap={4}>
                    <Text strong>ออกจากองค์กรนี้</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      คุณจะสูญเสียสิทธิ์ทั้งหมดในการจัดการโรงเรียนนี้
                    </Text>
                  </Flex>
                  <Button danger disabled style={{ minWidth: 120 }}>
                    ออกจากองค์กร
                  </Button>
                </Flex>
              </Card>
            </Col>
          </Row>
        )}

        {/* ─── Tab: แพ็คเกจ ──────────────────────────────────────────── */}
        {activeTab === "package" && <PackageTab userId={user.user_id} />}
      </div>

      {/* ─── Modals ────────────────────────────────────────────────────── */}
      <InviteModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvite={handleInvite}
        roles={roles}
      />
      <EditMemberModal
        open={!!editMember}
        member={editMember}
        onClose={() => setEditMember(null)}
        onSave={handleEditSave}
        roles={roles}
      />
    </div>
  );
}
