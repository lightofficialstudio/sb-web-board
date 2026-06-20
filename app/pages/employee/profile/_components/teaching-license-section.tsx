"use client";

import { ModalComponent } from "@/app/components/modal/modal.component";
import { deleteFile, extractStoragePath, getSignedUrl, uploadFile } from "@/app/lib/storage";
import { useAuthStore } from "@/app/stores/auth-store";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  Tag as TagIcon,
  WarningFilled,
} from "@ant-design/icons";
import {
  Button,
  Flex,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from "antd";
import type { RcFile } from "antd/es/upload";
import React, { useState } from "react";
import type { ResumeEntry } from "../_stores/profile-store";
import { useProfileStore } from "../_stores/profile-store";
import { postLicense, deleteLicense, patchSummary } from "../_api/employee-profile-api";

const { Text } = Typography;

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

// ✨ parse storage path จาก Supabase public URL
const parseStoragePath = (url: string, bucket: string): string | null => {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    return idx !== -1 ? url.slice(idx + marker.length) : null;
  } catch {
    return null;
  }
};

// Config สถานะใบประกอบวิชาชีพ
const LICENSE_STATUS_OPTIONS: {
  value: NonNullable<
    ReturnType<typeof useProfileStore.getState>["profile"]["licenseStatus"]
  >;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { value: "has_license", label: "มีใบอนุญาต", icon: <CheckCircleOutlined />, color: "#52c41a" },
  { value: "pending", label: "อยู่ระหว่างขอ", icon: <ClockCircleOutlined />, color: "#faad14" },
  { value: "no_license", label: "ไม่มีใบอนุญาต", icon: <CloseCircleOutlined />, color: "#ff4d4f" },
  {
    value: "not_required",
    label: "ตำแหน่งของฉันไม่ต้องใช้ใบอนุญาต",
    icon: <MinusCircleOutlined />,
    color: "#8c8c8c",
  },
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ✨ โครงสร้าง local modal state
interface ModalState {
  open: boolean;
  type: "success" | "error" | "confirm" | "delete";
  title: string;
  description: string;
  errorDetails?: unknown;
  loading?: boolean;
}

const MODAL_CLOSED: ModalState = { open: false, type: "success", title: "", description: "" };

export const TeachingLicenseSection: React.FC = () => {
  const { token } = theme.useToken();
  const {
    profile,
    setLicenseStatus,
    addLicenseAttachment,
    removeLicenseAttachment,
  } = useProfileStore();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const { user } = useAuthStore();

  const currentStatus = profile.licenseStatus ?? "";
  const attachments = profile.licenseAttachments ?? [];
  const showAttachment = currentStatus === "has_license" || currentStatus === "pending";

  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // ✨ เก็บไฟล์ที่รอการยืนยันลบ
  const [pendingDelete, setPendingDelete] = useState<ResumeEntry | null>(null);

  const closeModal = () => setModal(MODAL_CLOSED);

  // ✨ callback เมื่อกด "ยืนยันลบ"
  const handleDeleteConfirm = async () => {
    if (!pendingDelete || !user?.user_id) return;
    const attachment = pendingDelete;
    setPendingDelete(null);
    setDeletingId(attachment.id);
    setModal((prev) => ({ ...prev, open: false }));
    try {
      if (attachment.url) {
        const path = parseStoragePath(attachment.url, "licenses");
        if (path) await deleteFile("licenses", path);
      }
      const realId = attachment.id && UUID_REGEX.test(attachment.id) ? attachment.id : undefined;
      if (realId) {
        await deleteLicense(realId, user.user_id);
      }
      removeLicenseAttachment(attachment.id);
      setModal({
        open: true,
        type: "success",
        title: "ลบไฟล์สำเร็จ",
        description: `ไฟล์ "${attachment.fileName}" ถูกลบออกจากระบบเรียบร้อยแล้ว`,
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message_th?: string } }; message?: string };
      const description =
        axiosErr?.response?.data?.message_th ||
        axiosErr?.message ||
        "เกิดข้อผิดพลาดขณะลบไฟล์ กรุณาลองใหม่อีกครั้ง";
      setModal({ open: true, type: "error", title: "ลบไฟล์ไม่สำเร็จ", description, errorDetails: err });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBeforeUpload = (file: RcFile): boolean => {
    // 🔐 ตรวจประเภทไฟล์
    if (!ALLOWED_MIME.includes(file.type)) {
      setModal({
        open: true,
        type: "error",
        title: "ประเภทไฟล์ไม่รองรับ",
        description: "อนุญาตเฉพาะ PDF, JPG, PNG เท่านั้น กรุณาเลือกไฟล์ใหม่",
      });
      return false;
    }

    // 🔐 ตรวจขนาดไฟล์ ≤ 10 MB
    if (file.size > MAX_FILE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      setModal({
        open: true,
        type: "error",
        title: "ไฟล์มีขนาดใหญ่เกินไป",
        description: `ไฟล์ "${file.name}" มีขนาด ${sizeMB} MB เกินขีดจำกัด ${MAX_FILE_MB} MB กรุณาบีบอัดไฟล์แล้วลองใหม่`,
      });
      return false;
    }

    // 🔐 ป้องกันไฟล์ซ้ำ
    if (attachments.some((f) => f.fileName === file.name)) {
      setModal({
        open: true,
        type: "error",
        title: "ไฟล์ซ้ำ",
        description: `ไฟล์ "${file.name}" ถูกแนบไปแล้ว กรุณาเลือกไฟล์อื่น`,
      });
      return false;
    }

    if (!user?.user_id) {
      setModal({
        open: true,
        type: "error",
        title: "ไม่พบข้อมูลผู้ใช้",
        description: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
      });
      return false;
    }

    // ✨ Upload จริงไป Supabase Storage (licenses bucket) แล้ว save ลง DB
    (async () => {
      setIsUploading(true);
      try {
        const result = await uploadFile("licenses", user.user_id, file);
        // ✨ บันทึกลง DB ผ่าน 1:1 API แล้วใช้ id จริงจาก response
        const res = await postLicense(user.user_id, {
          license_name: file.name,
          file_url: result.url,
        });
        const newFile: ResumeEntry = {
          id: res.data?.id ?? `lic-${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toLocaleDateString("th-TH"),
          url: result.url,
        };
        addLicenseAttachment(newFile);
        setModal({
          open: true,
          type: "success",
          title: "แนบไฟล์สำเร็จ",
          description: `ไฟล์ "${file.name}" ถูกอัปโหลดและบันทึกเรียบร้อยแล้ว`,
        });
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message_th?: string } }; message?: string };
        const description =
          axiosErr?.response?.data?.message_th ||
          axiosErr?.message ||
          "เกิดข้อผิดพลาดขณะอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง";
        setModal({ open: true, type: "error", title: "อัปโหลดไฟล์ไม่สำเร็จ", description, errorDetails: err });
      } finally {
        setIsUploading(false);
      }
    })();

    return false;
  };

  return (
    <>
      {/* ✨ Modal กลาง — ทุก state รายงานผ่านนี้ */}
      <ModalComponent
        open={modal.open}
        type={modal.type}
        title={modal.title}
        description={modal.description}
        errorDetails={modal.errorDetails}
        loading={modal.loading}
        onClose={closeModal}
        onConfirm={modal.type === "confirm" ? handleDeleteConfirm : undefined}
        confirmLabel={modal.type === "confirm" ? "ยืนยันลบ" : "ตกลง"}
        cancelLabel="ยกเลิก"
      />

      <Flex vertical gap={16}>
        {/* ─── ตัวเลือกสถานะ ─── */}
        <Flex vertical gap={8}>
          <Text strong style={{ fontSize: 13 }}>
            <SafetyCertificateOutlined style={{ marginRight: 6 }} />
            สถานะใบประกอบวิชาชีพ
          </Text>
          <Flex vertical gap={8}>
            {LICENSE_STATUS_OPTIONS.map((opt) => {
              const isSelected = currentStatus === opt.value;
              return (
                <Flex
                  key={opt.value}
                  align="center"
                  gap={12}
                  onClick={async () => {
                    const previousStatus = profile.licenseStatus;
                    setLicenseStatus(opt.value);
                    if (user?.user_id) {
                      try {
                        await patchSummary(user.user_id, { license_status: opt.value });
                      } catch {
                        // ✨ rollback ถ้า API fail
                        setLicenseStatus(previousStatus ?? "");
                      }
                    }
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: token.borderRadius,
                    border: `1.5px solid ${isSelected ? opt.color : token.colorBorderSecondary}`,
                    backgroundColor: isSelected ? `${opt.color}0f` : token.colorFillQuaternary,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: isSelected ? `${opt.color}20` : token.colorFillTertiary,
                      color: isSelected ? opt.color : token.colorTextSecondary,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {opt.icon}
                  </Flex>
                  <Text
                    strong={isSelected}
                    style={{ fontSize: 13, color: isSelected ? opt.color : token.colorText }}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Tag
                      color={
                        opt.color === "#52c41a"
                          ? "success"
                          : opt.color === "#faad14"
                            ? "warning"
                            : opt.color === "#ff4d4f"
                              ? "error"
                              : "default"
                      }
                      style={{ marginLeft: "auto", fontSize: 11 }}
                    >
                      เลือกอยู่
                    </Tag>
                  )}
                </Flex>
              );
            })}
          </Flex>
        </Flex>

        {/* ─── แนบไฟล์ใบประกอบวิชาชีพ ─── */}
        {showAttachment && (
          <Flex vertical gap={10}>
            <Text strong style={{ fontSize: 13 }}>
              แนบไฟล์ใบประกอบวิชาชีพ
            </Text>

            {/* รายการไฟล์ที่แนบแล้ว */}
            {attachments.length > 0 && (
              <Flex vertical gap={8}>
                {attachments.map((file) => (
                  <Flex
                    key={file.id}
                    align="center"
                    justify="space-between"
                    style={{
                      padding: "10px 14px",
                      borderRadius: token.borderRadius,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      backgroundColor: token.colorFillQuaternary,
                    }}
                  >
                    {/* ─── ซ้าย: คลิกเพื่อเปิดไฟล์ ─── */}
                    <Flex
                      align="center"
                      gap={10}
                      style={{ cursor: file.url ? (openingId === file.id ? "wait" : "pointer") : "default", flex: 1, minWidth: 0 }}
                      onClick={async () => {
                        if (!file.url || openingId === file.id) return;
                        const path = extractStoragePath(file.url, "licenses");
                        if (!path) return;
                        setOpeningId(file.id);
                        try {
                          const signed = await getSignedUrl("licenses", path);
                          window.open(signed, "_blank", "noopener,noreferrer");
                        } catch {
                          setModal({ open: true, type: "error", title: "เปิดไฟล์ไม่สำเร็จ", description: "ไม่สามารถสร้างลิงก์เข้าถึงไฟล์ได้ กรุณาลองใหม่อีกครั้ง" });
                        } finally {
                          setOpeningId(null);
                        }
                      }}
                    >
                      <FilePdfOutlined style={{ fontSize: 20, color: "#ff4d4f", flexShrink: 0 }} />
                      <Flex vertical gap={2}>
                        <Text strong style={{ fontSize: 13, textDecoration: file.url ? "underline" : "none", textDecorationColor: token.colorTextSecondary }}>
                          {file.fileName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {openingId === file.id ? "กำลังเปิดไฟล์..." : `${formatFileSize(file.fileSize)} · อัพโหลด ${file.uploadedAt}`}
                        </Text>
                      </Flex>
                    </Flex>
                    <Tooltip title="ลบไฟล์นี้">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deletingId === file.id}
                        disabled={deletingId === file.id}
                        onClick={() => {
                          setPendingDelete(file);
                          setModal({
                            open: true,
                            type: "confirm",
                            title: "ยืนยันการลบไฟล์",
                            description: `ต้องการลบไฟล์ "${file.fileName}" ออกจากโปรไฟล์? การดำเนินการนี้ไม่สามารถเรียกคืนได้`,
                          });
                        }}
                      />
                    </Tooltip>
                  </Flex>
                ))}
              </Flex>
            )}

            <Upload
              accept=".pdf,.jpg,.jpeg,.png"
              showUploadList={false}
              beforeUpload={handleBeforeUpload}
              multiple={false}
              disabled={isUploading}
            >
              <Button
                icon={<PlusOutlined />}
                type="dashed"
                block
                loading={isUploading}
                disabled={isUploading}
                style={{ height: 40 }}
              >
                {isUploading ? "กำลังอัปโหลด..." : "แนบไฟล์ใบประกอบวิชาชีพ (PDF, JPG, PNG)"}
              </Button>
            </Upload>

            {/* ข้อกำหนดไฟล์ */}
            <Flex
              vertical
              gap={4}
              style={{
                padding: "10px 14px",
                borderRadius: token.borderRadius,
                backgroundColor: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Flex align="center" gap={6}>
                <WarningFilled style={{ color: token.colorWarning, fontSize: 12 }} />
                <Text strong style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  ข้อกำหนดการอัปโหลด
                </Text>
              </Flex>
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                • รองรับไฟล์ <Text strong style={{ color: token.colorText }}>PDF, JPG, PNG</Text>
              </Text>
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                • ขนาดไฟล์สูงสุด{" "}
                <Text strong style={{ color: token.colorError }}>
                  {MAX_FILE_MB} MB
                </Text>{" "}
                ต่อไฟล์
              </Text>
            </Flex>
          </Flex>
        )}
      </Flex>
    </>
  );
};
