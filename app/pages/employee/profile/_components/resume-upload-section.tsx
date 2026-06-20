"use client";

import { ModalComponent } from "@/app/components/modal/modal.component";
import {
  CheckCircleFilled,
  DeleteOutlined,
  FilePdfOutlined,
  PlusOutlined,
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
import { deleteFile, extractStoragePath, getSignedUrl, uploadFile } from "@/app/lib/storage";
import { useProfileStore } from "../_stores/profile-store";
import type { ResumeEntry } from "../_stores/profile-store";
import { postResume, putResume, deleteResume } from "../_api/employee-profile-api";

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

const { Text } = Typography;

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

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

interface ResumeUploadSectionProps {
  userId: string;
}

export const ResumeUploadSection: React.FC<ResumeUploadSectionProps> = ({ userId }) => {
  const { token } = theme.useToken();
  const { profile, addResume, removeResume, setActiveResume } = useProfileStore();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const resumes = profile.resumes ?? [];
  const activeResumeId = profile.activeResumeId ?? null;

  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // ✨ เก็บ resume ที่รอการยืนยันลบ
  const [pendingDelete, setPendingDelete] = useState<ResumeEntry | null>(null);

  const closeModal = () => setModal(MODAL_CLOSED);

  // ✨ callback เมื่อกด "ยืนยันลบ"
  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    const resume = pendingDelete;
    setPendingDelete(null);
    setDeletingId(resume.id);
    setModal((prev) => ({ ...prev, open: false }));
    try {
      if (resume.url) {
        const path = parseStoragePath(resume.url, "resumes");
        if (path) await deleteFile("resumes", path);
      }
      const realId = resume.id && UUID_REGEX.test(resume.id) ? resume.id : undefined;
      if (realId) {
        await deleteResume(realId, userId);
      }
      removeResume(resume.id);
      setModal({
        open: true,
        type: "success",
        title: "ลบเรซูเม่สำเร็จ",
        description: `ไฟล์ "${resume.fileName}" ถูกลบออกจากระบบเรียบร้อยแล้ว`,
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message_th?: string } }; message?: string };
      const description =
        axiosErr?.response?.data?.message_th ||
        axiosErr?.message ||
        "เกิดข้อผิดพลาดขณะลบไฟล์ กรุณาลองใหม่อีกครั้ง";
      setModal({ open: true, type: "error", title: "ลบเรซูเม่ไม่สำเร็จ", description, errorDetails: err });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBeforeUpload = (file: RcFile): boolean => {
    // 🔐 ตรวจประเภทไฟล์
    if (file.type !== "application/pdf") {
      setModal({
        open: true,
        type: "error",
        title: "ประเภทไฟล์ไม่ถูกต้อง",
        description: "รองรับเฉพาะไฟล์ PDF เท่านั้น กรุณาเลือกไฟล์ใหม่",
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
    if (resumes.some((r) => r.fileName === file.name)) {
      setModal({
        open: true,
        type: "error",
        title: "ไฟล์ซ้ำ",
        description: `ไฟล์ "${file.name}" ถูกแนบไปแล้ว กรุณาเลือกไฟล์อื่น`,
      });
      return false;
    }

    // ✨ Upload จริงไป Supabase Storage แล้ว save ลง DB
    (async () => {
      setIsUploading(true);
      try {
        const result = await uploadFile("resumes", userId, file);
        // ✨ บันทึกลง DB ผ่าน 1:1 API แล้วใช้ id จริงจาก response
        const res = await postResume(userId, {
          file_name: file.name,
          file_url: result.url,
          file_size: file.size,
        });
        const newResume: ResumeEntry = {
          id: res.data?.id ?? `resume-${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toLocaleDateString("th-TH"),
          url: result.url,
        };
        addResume(newResume);
        setModal({
          open: true,
          type: "success",
          title: "แนบเรซูเม่สำเร็จ",
          description: `ไฟล์ "${file.name}" ถูกอัปโหลดและบันทึกเรียบร้อยแล้ว`,
        });
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message_th?: string } }; message?: string };
        const description =
          axiosErr?.response?.data?.message_th ||
          axiosErr?.message ||
          "เกิดข้อผิดพลาดขณะอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง";
        setModal({ open: true, type: "error", title: "อัปโหลดเรซูเม่ไม่สำเร็จ", description, errorDetails: err });
      } finally {
        setIsUploading(false);
      }
    })();

    return false; // ป้องกัน auto-upload
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
        {/* ─── รายการเรซูเม่ที่แนบแล้ว ─── */}
        {resumes.length > 0 && (
          <Flex vertical gap={10}>
            {resumes.map((resume) => {
              const isActive = resume.id === activeResumeId;
              return (
                <Flex
                  key={resume.id}
                  align="center"
                  justify="space-between"
                  style={{
                    padding: "12px 16px",
                    borderRadius: token.borderRadius,
                    border: `1.5px solid ${isActive ? token.colorPrimary : token.colorBorderSecondary}`,
                    backgroundColor: isActive ? `${token.colorPrimary}0d` : token.colorFillQuaternary,
                  }}
                >
                  {/* ─── ซ้าย: คลิกเพื่อเปิดไฟล์ ─── */}
                  <Flex
                    align="center"
                    gap={10}
                    style={{ cursor: resume.url ? (openingId === resume.id ? "wait" : "pointer") : "default", flex: 1, minWidth: 0 }}
                    onClick={async () => {
                      if (!resume.url || openingId === resume.id) return;
                      const path = extractStoragePath(resume.url, "resumes");
                      if (!path) return;
                      setOpeningId(resume.id);
                      try {
                        const signed = await getSignedUrl("resumes", path);
                        window.open(signed, "_blank", "noopener,noreferrer");
                      } catch {
                        setModal({ open: true, type: "error", title: "เปิดไฟล์ไม่สำเร็จ", description: "ไม่สามารถสร้างลิงก์เข้าถึงไฟล์ได้ กรุณาลองใหม่อีกครั้ง" });
                      } finally {
                        setOpeningId(null);
                      }
                    }}
                  >
                    <FilePdfOutlined style={{ fontSize: 22, color: "#ff4d4f", flexShrink: 0 }} />
                    <Flex vertical gap={2}>
                      <Flex align="center" gap={8}>
                        <Text strong style={{ fontSize: 13, textDecoration: resume.url ? "underline" : "none", textDecorationColor: token.colorTextSecondary }}>
                          {resume.fileName}
                        </Text>
                        {isActive && (
                          <Tag
                            icon={<CheckCircleFilled />}
                            color="processing"
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            กำลังใช้งาน
                          </Tag>
                        )}
                      </Flex>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {openingId === resume.id ? "กำลังเปิดไฟล์..." : `${formatFileSize(resume.fileSize)} · อัพโหลด ${resume.uploadedAt}`}
                      </Text>
                    </Flex>
                  </Flex>

                  <Flex gap={8} align="center" style={{ flexShrink: 0 }}>
                    {!isActive && (
                      <Button
                        size="small"
                        type="default"
                        style={{ fontSize: 12 }}
                        onClick={async () => {
                          const previousActiveId = activeResumeId;
                          setActiveResume(resume.id);
                          const realId = resume.id && UUID_REGEX.test(resume.id) ? resume.id : undefined;
                          if (realId) {
                            try {
                              await putResume(realId, userId, { is_active: true });
                            } catch {
                              // ✨ rollback ถ้า API fail
                              setActiveResume(previousActiveId ?? resume.id);
                            }
                          }
                        }}
                      >
                        ตั้งเป็นที่ใช้งาน
                      </Button>
                    )}
                    <Tooltip title="ลบไฟล์นี้">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deletingId === resume.id}
                        disabled={deletingId === resume.id}
                        onClick={() => {
                          setPendingDelete(resume);
                          setModal({
                            open: true,
                            type: "confirm",
                            title: "ยืนยันการลบเรซูเม่",
                            description: `ต้องการลบไฟล์ "${resume.fileName}" ออกจากระบบ? ไฟล์จะถูกลบถาวรและไม่สามารถกู้คืนได้`,
                          });
                        }}
                      />
                    </Tooltip>
                  </Flex>
                </Flex>
              );
            })}
          </Flex>
        )}

        {/* ─── ปุ่มเพิ่มเรซูเม่ ─── */}
        <Upload
          accept=".pdf"
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
            style={{ height: 44 }}
          >
            {isUploading ? "กำลังอัปโหลด..." : "แนบเรซูเม่ (PDF)"}
          </Button>
        </Upload>

        {/* ─── ข้อกำหนดไฟล์ ─── */}
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
            • รองรับเฉพาะไฟล์ <Text strong style={{ color: token.colorText }}>PDF</Text> เท่านั้น
          </Text>
          <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
            • ขนาดไฟล์สูงสุด{" "}
            <Text strong style={{ color: token.colorError }}>
              {MAX_FILE_MB} MB
            </Text>{" "}
            ต่อไฟล์
          </Text>
          <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
            • สามารถแนบได้หลายไฟล์ และเลือกเรซูเม่ที่กำลังใช้งาน
          </Text>
        </Flex>
      </Flex>
    </>
  );
};
