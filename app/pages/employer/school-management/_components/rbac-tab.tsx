"use client";

/**
 * RBAC Tab — จัดการ Role-Based Access Control
 * เชื่อมกับ useOrgStore → API จริง
 *
 * โครงสร้าง:
 *  ├── RoleList         (ซ้าย) — รายการ Role ทั้งหมด + ปุ่มสร้าง
 *  ├── PermissionMatrix (ขวา) — ตาราง Resource × Action (checkbox)
 *  └── MemberRolePanel  (ล่าง) — กำหนด/เปลี่ยน Role ให้ Members
 */

import {
  AppstoreOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FileTextOutlined,
  LockOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification,
  theme,
} from "antd";
import { useEffect, useState } from "react";
import type { OrgMember, OrgRole } from "../_state/org-store";
import { useOrgStore } from "../_state/org-store";

const { Text, Title } = Typography;

// ─── RBAC Types ───────────────────────────────────────────────────────────────

type Resource =
  | "jobs"
  | "applicants"
  | "profile"
  | "members"
  | "analytics"
  | "settings";
type Action = "view" | "create" | "edit" | "delete" | "export" | "manage";

// ─── Resource & Action Definitions ───────────────────────────────────────────

const RESOURCES: {
  key: Resource;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    key: "jobs",
    label: "ประกาศงาน",
    icon: <FileTextOutlined />,
    description: "สร้าง แก้ไข ปิดประกาศงาน",
  },
  {
    key: "applicants",
    label: "ผู้สมัคร",
    icon: <TeamOutlined />,
    description: "ดู อัปเดตสถานะ ส่งออกข้อมูลผู้สมัคร",
  },
  {
    key: "profile",
    label: "โปรไฟล์โรงเรียน",
    icon: <AppstoreOutlined />,
    description: "แก้ไขข้อมูล โลโก้ รูปภาพโรงเรียน",
  },
  {
    key: "members",
    label: "จัดการสมาชิก",
    icon: <SafetyCertificateOutlined />,
    description: "เชิญ ลบ เปลี่ยนบทบาทสมาชิก",
  },
  {
    key: "analytics",
    label: "สถิติ & รายงาน",
    icon: <BarChartOutlined />,
    description: "ดูสถิติประกาศ ยอดเข้าชม ผู้สมัคร",
  },
  {
    key: "settings",
    label: "ตั้งค่าระบบ",
    icon: <SettingOutlined />,
    description: "ตั้งค่าองค์กร notification และความปลอดภัย",
  },
];

const ACTIONS: {
  key: Action;
  label: string;
  description: string;
  risk: "low" | "medium" | "high";
}[] = [
  { key: "view", label: "ดู", description: "อ่านข้อมูล", risk: "low" },
  {
    key: "create",
    label: "สร้าง",
    description: "เพิ่มข้อมูลใหม่",
    risk: "medium",
  },
  {
    key: "edit",
    label: "แก้ไข",
    description: "แก้ไขข้อมูลที่มีอยู่",
    risk: "medium",
  },
  { key: "delete", label: "ลบ", description: "ลบข้อมูลถาวร", risk: "high" },
  {
    key: "export",
    label: "ส่งออก",
    description: "ดาวน์โหลด / Export",
    risk: "medium",
  },
  {
    key: "manage",
    label: "จัดการ",
    description: "ควบคุมเต็มรูปแบบ",
    risk: "high",
  },
];

const buildPermissionKey = (resource: Resource, action: Action) =>
  `${resource}:${action}`;

// ─── Role Icon Map ────────────────────────────────────────────────────────────

const ROLE_ICON_MAP: Record<string, React.ReactNode> = {
  owner: <CrownOutlined />,
  admin: <SafetyCertificateOutlined />,
  hr_manager: <TeamOutlined />,
  staff: <UserOutlined />,
  recruiter: <SearchOutlined />,
};

const getRoleIcon = (slug: string): React.ReactNode =>
  ROLE_ICON_MAP[slug] ?? <UserOutlined />;

// ─── PRESET icon options สำหรับ Custom Role ──────────────────────────────────

const ICON_OPTIONS: { value: string; label: string; icon: React.ReactNode }[] =
  [
    { value: "user", label: "User", icon: <UserOutlined /> },
    { value: "team", label: "Team", icon: <TeamOutlined /> },
    { value: "safety", label: "Safety", icon: <SafetyCertificateOutlined /> },
    { value: "setting", label: "Setting", icon: <SettingOutlined /> },
    { value: "file", label: "File", icon: <FileTextOutlined /> },
    { value: "bar-chart", label: "Analytics", icon: <BarChartOutlined /> },
    { value: "search", label: "Search", icon: <SearchOutlined /> },
    { value: "export", label: "Export", icon: <ExportOutlined /> },
    { value: "eye", label: "View", icon: <EyeOutlined /> },
    { value: "lock", label: "Lock", icon: <LockOutlined /> },
  ];

const getIconByValue = (value: string): string => value;

// ─── Risk Badge ───────────────────────────────────────────────────────────────

const RiskBadge = ({ risk }: { risk: "low" | "medium" | "high" }) => {
  const { token } = theme.useToken();
  const COLOR = {
    low: token.colorSuccess,
    medium: token.colorWarning,
    high: token.colorError,
  };
  const LABEL = { low: "ต่ำ", medium: "กลาง", high: "สูง" };
  return (
    <span style={{ fontSize: 10, color: COLOR[risk], fontWeight: 600 }}>
      {LABEL[risk]}
    </span>
  );
};

// ─── Role Form Modal ──────────────────────────────────────────────────────────

const RoleFormModal = ({
  open,
  role,
  onClose,
  onSave,
  loading,
}: {
  open: boolean;
  role: OrgRole | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    color: string;
    icon_key: string;
  }) => Promise<void>;
  loading?: boolean;
}) => {
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const isCreate = !role;

  const PRESET_COLORS = [
    "#11b6f5",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EF4444",
    "#EC4899",
    "#94A3B8",
  ];

  useEffect(() => {
    if (open) {
      if (role) {
        form.setFieldsValue({
          name: role.name,
          description: role.description ?? "",
          color: role.color,
          iconValue: role.iconKey,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ color: "#11b6f5", iconValue: "user" });
      }
    }
  }, [open, role, form]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      forceRender
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
            <SafetyCertificateOutlined
              style={{ color: "#fff", fontSize: 16 }}
            />
          </Flex>
          <Text strong style={{ fontSize: 15 }}>
            {isCreate ? "สร้าง Role ใหม่" : `แก้ไข: ${role?.name}`}
          </Text>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ color: "#11b6f5", iconValue: "user" }}
        onFinish={async (v) => {
          await onSave({
            name: v.name,
            description: v.description ?? "",
            color: v.color ?? "#94A3B8",
            icon_key: v.iconValue ?? "user",
          });
          form.resetFields();
        }}
        style={{ marginTop: 16 }}
      >
        <Row gutter={12}>
          <Col span={16}>
            <Form.Item
              label="ชื่อ Role"
              name="name"
              rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
            >
              <Input placeholder="เช่น HR Manager" size="large" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Icon" name="iconValue">
              <Select size="large">
                {ICON_OPTIONS.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    <Flex align="center" gap={6}>
                      <span style={{ fontSize: 14 }}>{opt.icon}</span>
                      <Text style={{ fontSize: 12 }}>{opt.label}</Text>
                    </Flex>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="คำอธิบาย" name="description">
          <Input.TextArea
            rows={2}
            placeholder="อธิบายหน้าที่และขอบเขตของ Role นี้"
          />
        </Form.Item>

        <Form.Item label="สีประจำ Role" name="color">
          <Flex gap={8} wrap="wrap">
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => form.setFieldValue("color", c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: c,
                  cursor: "pointer",
                  outline:
                    form.getFieldValue("color") === c
                      ? `3px solid ${token.colorText}`
                      : "2px solid transparent",
                  outlineOffset: 2,
                  transition: "outline 0.15s",
                }}
              />
            ))}
          </Flex>
        </Form.Item>

        <Flex
          style={{
            backgroundColor: token.colorWarningBg,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
          }}
          gap={8}
          align="flex-start"
        >
          <WarningOutlined
            style={{ color: token.colorWarning, marginTop: 2 }}
          />
          <Text style={{ fontSize: 12, color: token.colorWarningText }}>
            หลังสร้าง Role แล้ว ให้ไปกำหนด Permission ใน Permission Matrix
          </Text>
        </Flex>

        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={isCreate ? <PlusOutlined /> : <EditOutlined />}
            loading={loading}
          >
            {isCreate ? "สร้าง Role" : "บันทึก"}
          </Button>
        </Flex>
      </Form>
    </Modal>
  );
};

// ─── Permission Matrix ────────────────────────────────────────────────────────

const PermissionMatrix = ({
  role,
  localPerms,
  onPermissionChange,
}: {
  role: OrgRole;
  localPerms: string[];
  onPermissionChange: (key: string, checked: boolean) => void;
}) => {
  const { token } = theme.useToken();

  const isChecked = (resource: Resource, action: Action) =>
    localPerms.includes(buildPermissionKey(resource, action));

  const isRowAllChecked = (resource: Resource) =>
    ACTIONS.every((a) =>
      localPerms.includes(buildPermissionKey(resource, a.key)),
    );

  const isRowIndeterminate = (resource: Resource) => {
    const count = ACTIONS.filter((a) =>
      localPerms.includes(buildPermissionKey(resource, a.key)),
    ).length;
    return count > 0 && count < ACTIONS.length;
  };

  const toggleRow = (resource: Resource, checked: boolean) => {
    ACTIONS.forEach((a) => {
      const key = buildPermissionKey(resource, a.key);
      const has = localPerms.includes(key);
      if (checked && !has) onPermissionChange(key, true);
      if (!checked && has) onPermissionChange(key, false);
    });
  };

  if (role.isSystem && role.slug === "owner") {
    return (
      <Flex align="center" justify="center" style={{ padding: "40px 0" }}>
        <Flex vertical align="center" gap={12}>
          <CrownOutlined style={{ fontSize: 32, color: token.colorWarning }} />
          <Text strong>Owner มีสิทธิ์ทุกอย่างโดย default</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            ไม่สามารถจำกัดหรือแก้ไขสิทธิ์ของ Owner ได้
          </Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={0}>
      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px repeat(6, 1fr)",
          backgroundColor: token.colorFillQuaternary,
          borderRadius: "8px 8px 0 0",
          padding: "10px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text
          type="secondary"
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          ทรัพยากร
        </Text>
        {ACTIONS.map((a) => (
          <Flex key={a.key} vertical align="center" gap={3}>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</Text>
            <RiskBadge risk={a.risk} />
          </Flex>
        ))}
      </div>

      {/* Rows */}
      {RESOURCES.map((res, ri) => (
        <div
          key={res.key}
          style={{
            display: "grid",
            gridTemplateColumns: "220px repeat(6, 1fr)",
            padding: "12px 16px",
            alignItems: "center",
            backgroundColor:
              ri % 2 === 0 ? token.colorBgContainer : token.colorFillQuaternary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {/* Resource label */}
          <Flex align="center" gap={10}>
            <Checkbox
              checked={isRowAllChecked(res.key)}
              indeterminate={isRowIndeterminate(res.key)}
              onChange={(e) => toggleRow(res.key, e.target.checked)}
              disabled={role.isSystem}
            />
            <Flex align="center" gap={6}>
              <span style={{ color: token.colorPrimary, fontSize: 14 }}>
                {res.icon}
              </span>
              <Flex vertical gap={1}>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {res.label}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {res.description}
                </Text>
              </Flex>
            </Flex>
          </Flex>

          {/* Action checkboxes */}
          {ACTIONS.map((action) => {
            const key = buildPermissionKey(res.key, action.key);
            const checked = isChecked(res.key, action.key);
            const notApplicable =
              (res.key === "analytics" &&
                ["create", "edit", "delete", "manage"].includes(action.key)) ||
              (res.key === "settings" &&
                ["create", "delete", "export"].includes(action.key));

            return (
              <Flex key={key} justify="center" align="center">
                {notApplicable ? (
                  <Text
                    type="secondary"
                    style={{ fontSize: 16, lineHeight: 1 }}
                  >
                    —
                  </Text>
                ) : (
                  <Tooltip
                    title={`${res.label}: ${action.label} (ความเสี่ยง: ${action.risk})`}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={(e) =>
                        onPermissionChange(key, e.target.checked)
                      }
                      disabled={role.isSystem}
                    />
                  </Tooltip>
                )}
              </Flex>
            );
          })}
        </div>
      ))}

      {/* Summary footer */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px repeat(6, 1fr)",
          padding: "10px 16px",
          backgroundColor: token.colorFillSecondary,
          borderRadius: "0 0 8px 8px",
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {localPerms.length} permission ทั้งหมด
        </Text>
        {ACTIONS.map((a) => {
          const count = RESOURCES.filter((r) =>
            localPerms.includes(buildPermissionKey(r.key, a.key)),
          ).length;
          return (
            <Flex key={a.key} justify="center">
              <Text
                style={{
                  fontSize: 12,
                  color:
                    count > 0 ? token.colorPrimary : token.colorTextQuaternary,
                }}
              >
                {count}/{RESOURCES.length}
              </Text>
            </Flex>
          );
        })}
      </div>

      {role.isSystem && (
        <Alert
          style={{ marginTop: 12, borderRadius: 8 }}
          title="System Role — ไม่สามารถแก้ไข Permission ได้"
          description="Role นี้เป็น built-in role ของระบบ หากต้องการ Permission แบบกำหนดเอง ให้สร้าง Custom Role ใหม่"
          type="warning"
          showIcon
          icon={<LockOutlined />}
        />
      )}
    </Flex>
  );
};

// ─── Member Role Assignment Panel ────────────────────────────────────────────

const MemberRolePanel = ({
  members,
  roles,
  userId,
  delegatedOrgId,
}: {
  members: OrgMember[];
  roles: OrgRole[];
  userId: string;
  delegatedOrgId?: string | null;
}) => {
  const { token } = theme.useToken();
  const { updateMemberRole } = useOrgStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [api, contextHolder] = notification.useNotification();

  const getEffectivePermissions = (member: OrgMember): Set<string> => {
    const all = new Set<string>();
    member.role.permissions.forEach((p) => all.add(p.permissionKey));
    return all;
  };

  const handleRoleChange = async (memberId: string, roleId: string) => {
    try {
      await updateMemberRole(userId, memberId, roleId, delegatedOrgId);
      api.success({ message: "อัปเดตบทบาทของสมาชิกแล้ว" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      api.error({ message: "ไม่สามารถอัปเดตบทบาทได้", description: msg });
    }
  };

  const columns = [
    {
      title: "สมาชิก",
      key: "member",
      render: (_: unknown, m: OrgMember) => {
        const displayName =
          [m.profile.firstName, m.profile.lastName].filter(Boolean).join(" ") ||
          m.profile.email;
        return (
          <Flex align="center" gap={10}>
            <Avatar
              size={36}
              src={m.profile.profileImageUrl}
              style={{
                backgroundColor: token.colorPrimary,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {displayName.charAt(0)}
            </Avatar>
            <Flex vertical gap={1}>
              <Text strong style={{ fontSize: 13 }}>
                {displayName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {m.profile.email}
              </Text>
            </Flex>
          </Flex>
        );
      },
    },
    {
      title: "Role ที่ได้รับ",
      key: "role",
      render: (_: unknown, m: OrgMember) => (
        <Select
          value={m.roleId}
          style={{ minWidth: 200 }}
          onChange={(val) => handleRoleChange(m.id, val)}
          disabled={m.role.slug === "owner"}
          placeholder="เลือก Role"
          options={roles.map((r) => ({
            value: r.id,
            label: (
              <Flex align="center" gap={6}>
                <span style={{ color: r.color, fontSize: 13 }}>
                  {getRoleIcon(r.slug)}
                </span>
                <Text style={{ fontSize: 12 }}>{r.name}</Text>
              </Flex>
            ),
            disabled: r.slug === "owner",
          }))}
        />
      ),
    },
    {
      title: "สิทธิ์รวม (Effective)",
      key: "perms",
      render: (_: unknown, m: OrgMember) => {
        const perms = getEffectivePermissions(m);
        return (
          <Flex align="center" gap={6}>
            <Tag color="blue" style={{ fontSize: 12 }}>
              {perms.size} permissions
            </Tag>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
              style={{ fontSize: 12 }}
            >
              {expandedId === m.id ? "ซ่อน" : "ดูรายละเอียด"}
            </Button>
          </Flex>
        );
      },
    },
    {
      title: "สถานะ",
      key: "status",
      width: 100,
      render: (_: unknown, m: OrgMember) => (
        <Badge
          status={m.status === "ACTIVE" ? "success" : "warning"}
          text={m.status === "ACTIVE" ? "ใช้งาน" : "รอยืนยัน"}
        />
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Table
        columns={columns}
        dataSource={members}
        rowKey="id"
        pagination={false}
        expandable={{
          expandedRowKeys: expandedId ? [expandedId] : [],
          showExpandColumn: false,
          expandedRowRender: (m: OrgMember) => {
            const perms = getEffectivePermissions(m);
            return (
              <div
                style={{
                  padding: "16px 24px",
                  backgroundColor: token.colorFillQuaternary,
                  borderRadius: 8,
                  margin: "4px 0",
                }}
              >
                <Text
                  strong
                  style={{ fontSize: 13, display: "block", marginBottom: 12 }}
                >
                  Effective Permissions ของ{" "}
                  {[m.profile.firstName, m.profile.lastName]
                    .filter(Boolean)
                    .join(" ") || m.profile.email}
                </Text>

                {/* Mini matrix */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px repeat(6, 1fr)",
                    gap: "6px 0",
                  }}
                >
                  <div />
                  {ACTIONS.map((a) => (
                    <Text
                      key={a.key}
                      style={{
                        fontSize: 11,
                        textAlign: "center",
                        color: token.colorTextSecondary,
                      }}
                    >
                      {a.label}
                    </Text>
                  ))}
                  {RESOURCES.map((res) => (
                    <>
                      <Flex key={`${res.key}-label`} align="center" gap={4}>
                        <span
                          style={{ color: token.colorPrimary, fontSize: 12 }}
                        >
                          {res.icon}
                        </span>
                        <Text style={{ fontSize: 12 }}>{res.label}</Text>
                      </Flex>
                      {ACTIONS.map((a) => {
                        const key = buildPermissionKey(res.key, a.key);
                        return (
                          <Flex key={key} justify="center" align="center">
                            {perms.has(key) ? (
                              <CheckCircleFilled
                                style={{
                                  color: token.colorSuccess,
                                  fontSize: 14,
                                }}
                              />
                            ) : (
                              <CloseCircleOutlined
                                style={{
                                  color: token.colorTextQuaternary,
                                  fontSize: 14,
                                }}
                              />
                            )}
                          </Flex>
                        );
                      })}
                    </>
                  ))}
                </div>

                <Divider style={{ margin: "12px 0 8px" }} />
                <Flex align="center" gap={8} wrap="wrap">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    มาจาก Role:
                  </Text>
                  <Tag
                    icon={
                      <span style={{ marginRight: 4, fontSize: 12 }}>
                        {getRoleIcon(m.role.slug)}
                      </span>
                    }
                    style={{
                      backgroundColor: m.role.color + "22",
                      borderColor: m.role.color,
                      color: m.role.color,
                      fontSize: 12,
                    }}
                  >
                    {m.role.name}
                  </Tag>
                </Flex>
              </div>
            );
          },
        }}
      />
    </>
  );
};

// ─── RBAC Tab (main export) ───────────────────────────────────────────────────

export const RbacTab = ({
  userId,
  delegatedOrgId,
}: {
  userId: string;
  delegatedOrgId?: string | null;
}) => {
  const { token } = theme.useToken();
  const [api, contextHolder] = notification.useNotification();

  const {
    roles,
    members,
    isLoadingRoles,
    isLoadingMembers,
    fetchRoles,
    fetchMembers,
    createRole,
    updateRole,
    deleteRole,
    savePermissions,
  } = useOrgStore();

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [section, setSection] = useState<"matrix" | "members">("matrix");
  const [savingPerms, setSavingPerms] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  // Local copy of permissions for selected role (for matrix editing before save)
  const [localPerms, setLocalPerms] = useState<string[]>([]);

  useEffect(() => {
    fetchRoles(userId, delegatedOrgId);
    fetchMembers(userId, delegatedOrgId);
  }, [userId, delegatedOrgId]);

  // ✨ Set default selected role to admin when roles load
  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      const adminRole = roles.find((r) => r.slug === "admin") ?? roles[0];
      setSelectedRoleId(adminRole.id);
    }
  }, [roles]);

  // ✨ Sync localPerms when selected role changes
  useEffect(() => {
    const role = roles.find((r) => r.id === selectedRoleId);
    if (role) {
      setLocalPerms(role.permissions.map((p) => p.permissionKey));
    }
  }, [selectedRoleId, roles]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handlePermissionChange = (key: string, checked: boolean) => {
    setLocalPerms((prev) =>
      checked ? [...prev, key] : prev.filter((p) => p !== key),
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setSavingPerms(true);
    try {
      await savePermissions(userId, selectedRoleId, localPerms, delegatedOrgId);
      api.success({
        message: `บันทึก Permission ของ "${selectedRole.name}" แล้ว`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      api.error({
        message: "ไม่สามารถบันทึก Permission ได้",
        description: msg,
      });
    } finally {
      setSavingPerms(false);
    }
  };

  const handleSaveRole = async (data: {
    name: string;
    description: string;
    color: string;
    icon_key: string;
  }) => {
    setSavingRole(true);
    try {
      if (editingRole) {
        await updateRole(userId, editingRole.id, data, delegatedOrgId);
        api.success({ message: `อัปเดต Role "${data.name}" แล้ว` });
      } else {
        const newRole = await createRole(userId, data, delegatedOrgId);
        setSelectedRoleId(newRole.id);
        api.success({
          message: `สร้าง Role "${newRole.name}" แล้ว — กำหนด Permission ได้เลย`,
        });
      }
      setRoleFormOpen(false);
      setEditingRole(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      api.error({ message: "ไม่สามารถบันทึก Role ได้", description: msg });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: OrgRole) => {
    try {
      await deleteRole(userId, role.id, delegatedOrgId);
      if (selectedRoleId === role.id) {
        const fallback =
          roles.find((r) => r.slug === "admin" && r.id !== role.id) ?? roles[0];
        if (fallback) setSelectedRoleId(fallback.id);
      }
      api.success({ message: `ลบ Role "${role.name}" แล้ว` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      api.error({ message: "ไม่สามารถลบ Role ได้", description: msg });
    }
  };

  // ─── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoadingRoles && roles.length === 0) {
    return (
      <Card variant="borderless" style={{ borderRadius: 14 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!selectedRole && roles.length > 0) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Flex vertical gap={20}>
      {contextHolder}

      {/* Header card */}
      <Card
        variant="borderless"
        style={{ borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        styles={{ body: { padding: "20px 24px" } }}
      >
        <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
          <Flex vertical gap={4}>
            <Flex align="center" gap={8}>
              <LockOutlined
                style={{ color: token.colorPrimary, fontSize: 18 }}
              />
              <Title level={5} style={{ margin: 0 }}>
                Role-Based Access Control (RBAC)
              </Title>
            </Flex>
            <Text type="secondary" style={{ fontSize: 13 }}>
              กำหนดสิทธิ์การเข้าถึงระบบตามบทบาท — รองรับ Custom Role,
              กำหนดสิทธิ์รายบุคคล
            </Text>
          </Flex>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setEditingRole(null);
              setRoleFormOpen(true);
            }}
          >
            สร้าง Role ใหม่
          </Button>
        </Flex>

        {/* Sub-section tabs */}
        <Flex
          gap={0}
          style={{
            marginTop: 16,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {[
            {
              key: "matrix",
              label: "Permission Matrix",
              icon: <AppstoreOutlined />,
            },
            {
              key: "members",
              label: "กำหนด Role ให้สมาชิก",
              icon: <TeamOutlined />,
            },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setSection(t.key as typeof section)}
              style={{
                padding: "8px 18px",
                border: "none",
                borderBottom:
                  section === t.key
                    ? `2px solid ${token.colorPrimary}`
                    : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: section === t.key ? 600 : 400,
                color:
                  section === t.key
                    ? token.colorPrimary
                    : token.colorTextSecondary,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -1,
                transition: "all 0.2s",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </Flex>
      </Card>

      {/* Main content */}
      <Row gutter={[16, 16]}>
        {/* Left: Role List */}
        <Col xs={24} lg={6}>
          <Card
            variant="borderless"
            style={{
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              position: "sticky",
              top: 80,
            }}
            styles={{ body: { padding: 0 } }}
            title={
              <Flex align="center" gap={6}>
                <SafetyCertificateOutlined
                  style={{ color: token.colorPrimary }}
                />
                <Text strong style={{ fontSize: 14 }}>
                  Roles ({roles.length})
                </Text>
              </Flex>
            }
          >
            {isLoadingRoles ? (
              <div style={{ padding: "16px" }}>
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : (
              <Flex vertical gap={0}>
                {roles.map((role, i) => (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      backgroundColor:
                        selectedRoleId === role.id
                          ? "rgba(17,182,245,0.08)"
                          : "transparent",
                      borderLeft:
                        selectedRoleId === role.id
                          ? `3px solid ${token.colorPrimary}`
                          : "3px solid transparent",
                      borderBottom:
                        i < roles.length - 1
                          ? `1px solid ${token.colorBorderSecondary}`
                          : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    <Flex justify="space-between" align="center">
                      <Flex align="center" gap={10}>
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: role.color + "22",
                            color: role.color,
                            fontSize: 15,
                            flexShrink: 0,
                          }}
                        >
                          {getRoleIcon(role.slug)}
                        </Flex>
                        <Flex vertical gap={1}>
                          <Flex align="center" gap={4}>
                            <Text
                              strong
                              style={{
                                fontSize: 13,
                                color:
                                  selectedRoleId === role.id
                                    ? token.colorPrimary
                                    : token.colorText,
                              }}
                            >
                              {role.name}
                            </Text>
                            {role.isSystem && (
                              <Tooltip title="System Role — ไม่สามารถลบได้">
                                <LockOutlined
                                  style={{
                                    fontSize: 10,
                                    color: token.colorTextQuaternary,
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Flex>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {role._count.members} คน · {role.permissions.length}{" "}
                            perms
                          </Text>
                        </Flex>
                      </Flex>

                      {!role.isSystem && (
                        <Flex gap={2} onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="แก้ไข">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined style={{ fontSize: 12 }} />}
                              onClick={() => {
                                setEditingRole(role);
                                setRoleFormOpen(true);
                              }}
                            />
                          </Tooltip>
                          <Popconfirm
                            title={`ลบ Role "${role.name}"?`}
                            description="สมาชิกที่มี Role นี้จะสูญเสีย Permission ที่เกี่ยวข้อง"
                            onConfirm={() => handleDeleteRole(role)}
                            okText="ลบ"
                            cancelText="ยกเลิก"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                            />
                          </Popconfirm>
                        </Flex>
                      )}
                    </Flex>
                  </div>
                ))}
              </Flex>
            )}
          </Card>
        </Col>

        {/* Right: Matrix or Member assignment */}
        <Col xs={24} lg={18}>
          {section === "matrix" && selectedRole ? (
            <Card
              variant="borderless"
              style={{
                borderRadius: 14,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
              title={
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={10}>
                    <Flex
                      align="center"
                      justify="center"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: selectedRole.color + "22",
                        color: selectedRole.color,
                        fontSize: 16,
                      }}
                    >
                      {getRoleIcon(selectedRole.slug)}
                    </Flex>
                    <Flex vertical gap={1}>
                      <Flex align="center" gap={8}>
                        <Text strong style={{ fontSize: 15 }}>
                          {selectedRole.name}
                        </Text>
                        <Tag
                          color={selectedRole.isSystem ? "default" : "green"}
                          style={{ fontSize: 11 }}
                        >
                          {selectedRole.isSystem ? "System" : "Custom"}
                        </Tag>
                      </Flex>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedRole.description}
                      </Text>
                    </Flex>
                  </Flex>
                  {!selectedRole.isSystem && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleFilled />}
                      loading={savingPerms}
                      onClick={handleSavePermissions}
                    >
                      บันทึก
                    </Button>
                  )}
                </Flex>
              }
            >
              {/* Legend */}
              <Flex
                gap={20}
                style={{ marginBottom: 16 }}
                wrap="wrap"
                align="center"
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ระดับความเสี่ยง:
                </Text>
                {[
                  { color: token.colorSuccess, label: "ต่ำ — อ่านข้อมูล" },
                  { color: token.colorWarning, label: "กลาง — แก้ไข / ส่งออก" },
                  { color: token.colorError, label: "สูง — ลบ / จัดการเต็ม" },
                ].map((item) => (
                  <Flex key={item.label} align="center" gap={5}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: item.color,
                        display: "inline-block",
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.label}
                    </Text>
                  </Flex>
                ))}
                <Flex align="center" gap={4}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    — = ไม่มี Action นี้สำหรับ Resource นี้
                  </Text>
                </Flex>
              </Flex>

              <PermissionMatrix
                role={selectedRole}
                localPerms={localPerms}
                onPermissionChange={handlePermissionChange}
              />
            </Card>
          ) : section === "members" ? (
            <Card
              variant="borderless"
              style={{
                borderRadius: 14,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
              title={
                <Flex align="center" gap={8}>
                  <TeamOutlined style={{ color: token.colorPrimary }} />
                  <Text strong style={{ fontSize: 15 }}>
                    กำหนด Role ให้สมาชิก
                  </Text>
                  <Tooltip title="สมาชิก 1 คนมี 1 Role — กด 'ดูรายละเอียด' เพื่อดู Effective Permissions">
                    <QuestionCircleOutlined
                      style={{ color: token.colorTextQuaternary }}
                    />
                  </Tooltip>
                </Flex>
              }
            >
              <Alert
                style={{ marginBottom: 16, borderRadius: 8 }}
                title="Role Assignment"
                description="เปลี่ยน Role ของสมาชิกได้โดยตรง — ระบบจะอัปเดตทันที กด 'ดูรายละเอียด' เพื่อตรวจสอบ Effective Permissions"
                type="info"
                showIcon
              />
              {isLoadingMembers ? (
                <div style={{ padding: "24px" }}>
                  <Skeleton active avatar paragraph={{ rows: 8 }} />
                </div>
              ) : (
                <MemberRolePanel
                  members={members}
                  roles={roles}
                  userId={userId}
                  delegatedOrgId={delegatedOrgId}
                />
              )}
            </Card>
          ) : null}
        </Col>
      </Row>

      <RoleFormModal
        open={roleFormOpen}
        role={editingRole}
        onClose={() => {
          setRoleFormOpen(false);
          setEditingRole(null);
        }}
        onSave={handleSaveRole}
        loading={savingRole}
      />
    </Flex>
  );
};
