"use client";

import { ModalComponent } from "@/app/components/modal/modal.component";
import { uploadFile } from "@/app/lib/storage";
import { useAuthStore } from "@/app/stores/auth-store";
import {
  CalendarOutlined,
  CameraOutlined,
  CheckCircleFilled,
  EditOutlined,
  EnvironmentOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  GlobalOutlined,
  LinkOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Layout,
  Progress,
  Radio,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  theme as antTheme,
} from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TopProgressBar } from "@/app/components/top-progress-bar/top-progress-bar.component";
import { motion } from "framer-motion";
import { patchBasicInfo, patchSummary } from "./_api/employee-profile-api";
import { patchWorkLocation } from "./_api/work-location-api";
import {
  AvatarCropModal,
  BasicInfoSection,
  EducationHistorySection,
  GenderDobPhotoSection,
  PersonalSummarySection,
  ProfileEditDrawer,
  ProfileSectionWrapper,
  ResumeUploadSection,
  SkillsLocationSection,
  TeachingLicenseSection,
  TeachingSkillsSection,
  WorkExperienceSection,
} from "./_components";
import { WorkLocationSection } from "./_components/work-location-section";
import { useProfileStore } from "./_stores/profile-store";

const { Title, Text, Link } = Typography;
const { Content } = Layout;

type SectionId =
  | "basic-info"
  | "personal-info"
  | "education"
  | "work-experience"
  | "skills"
  | "teaching-skills"
  | "personal-summary"
  | "work-location";

export default function EmployeeProfilePage() {
  const { token } = antTheme.useToken();
  const {
    profile,
    setProfile,
    updateField,
    fetchProfile,
    saveProfile,
    refreshStrength,
    isLoading,
  } = useProfileStore();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const router = useRouter();
  const [form] = Form.useForm();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [showAvatarSuccess, setShowAvatarSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>("");
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // ✨ Modal state มาตรฐาน — ใช้ ModalComponent แทน openNotification ทุกจุด
  interface ModalState {
    open: boolean;
    type: "success" | "error" | "confirm" | "delete";
    title: string;
    description: string;
    errorDetails?: unknown;
  }
  const MODAL_CLOSED: ModalState = {
    open: false,
    type: "success",
    title: "",
    description: "",
  };
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const closeModal = () => setModal(MODAL_CLOSED);

  // ✨ เลือกไฟล์ → validate → เปิด crop modal (ยังไม่ upload)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.user_id) return;
    e.target.value = "";

    // 🔐 ตรวจสอบประเภทไฟล์
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_MIME.includes(file.type)) {
      setModal({ open: true, type: "error", title: "ประเภทไฟล์ไม่ถูกต้อง", description: "รองรับเฉพาะ JPEG, PNG และ WebP เท่านั้น" });
      return;
    }
    // 🔐 ตรวจสอบขนาดไฟล์ ≤ 10 MB
    if (file.size > 10 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setModal({ open: true, type: "error", title: "ไฟล์มีขนาดใหญ่เกินไป", description: `ไฟล์มีขนาด ${mb} MB เกินขีดจำกัด 10 MB` });
      return;
    }

    // ✨ อ่านไฟล์เป็น data URL แล้วเปิด crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setPendingFileName(file.name);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // ✨ upload หลังจาก user กด "ยืนยัน" ใน crop modal
  const handleCropConfirm = async (blob: Blob) => {
    if (!user?.user_id) return;
    setIsCropModalOpen(false);
    setIsAvatarUploading(true);
    try {
      const croppedFile = new File([blob], pendingFileName || "avatar.jpg", { type: "image/jpeg" });
      const result = await uploadFile("avatars", user.user_id, croppedFile);
      updateField("profileImageUrl", result.url);
      await patchBasicInfo(user.user_id, { profile_image_url: result.url });
      updateUser({ profile_image_url: result.url });
      setShowAvatarSuccess(true);
      setTimeout(() => setShowAvatarSuccess(false), 1800);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message_th?: string } }; message?: string };
      setModal({
        open: true,
        type: "error",
        title: "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ",
        description: axiosErr?.response?.data?.message_th ?? axiosErr?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่",
        errorDetails: err,
      });
    } finally {
      setIsAvatarUploading(false);
      setCropSrc("");
      setPendingFileName("");
    }
  };

  // ✨ รอให้ Zustand hydrate จาก localStorage เสร็จก่อน (ป้องกัน redirect ผิดพลาดตอน refresh)
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✨ Guard: ตรวจสอบหลังจาก hydrate เสร็จแล้วเท่านั้น
  useEffect(() => {
    if (!isMounted) return;
    if (!isAuthenticated || !user) {
      router.replace("/pages/signin?redirect=%2Fpages%2Femployee%2Fprofile");
      return;
    }
    if (user.role !== "EMPLOYEE") {
      router.replace(
        user.role === "EMPLOYER" ? "/pages/employer/profile" : "/",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, isAuthenticated, user?.role]);

  // ✨ โหลดข้อมูลโปรไฟล์จาก API โดยใช้ user_id + email จาก auth-store
  // ส่ง email ไปด้วยเพื่อให้ API auto-create profile ถ้ายังไม่มีใน DB
  useEffect(() => {
    if (!isMounted) return;
    if (user?.user_id) {
      fetchProfile(user.user_id, user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, user?.user_id]);

  // ✨ sync รูปโปรไฟล์จาก profileStore → authStore เมื่อโหลดเสร็จ (Navbar จะอัปเดตทันที)
  useEffect(() => {
    if (!profile.profileImageUrl) return;
    if (profile.profileImageUrl !== user?.profile_image_url) {
      updateUser({ profile_image_url: profile.profileImageUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.profileImageUrl]);

  const [editSection, setEditSection] = useState<SectionId | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ✨ profileStrength คำนวณโดย API — UI แสดงผลเท่านั้น
  const strengthScore = profile.profileStrength?.score ?? 0;
  const missingFields = profile.profileStrength?.missingFields ?? [];

  const handleOpenEdit = (sectionId: SectionId) => {
    setEditSection(sectionId);
    if (sectionId === "basic-info") {
      form.setFieldsValue({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phoneNumber: profile.phoneNumber,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth ? dayjs(profile.dateOfBirth) : null,
        nationality: profile.nationality,
        preferredProvinces: profile.preferredProvinces ?? [],
        canRelocate: profile.canRelocate ?? false,
      });
    } else if (sectionId === "personal-info") {
      form.setFieldsValue({
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth ? dayjs(profile.dateOfBirth) : null,
      });
    } else if (sectionId === "teaching-skills") {
      // ✨ TeachingSkillsSection ใช้ field: specialization + languageAndItSkills (combined)
      form.setFieldsValue({
        specialization: profile.specialization,
        languageAndItSkills: [
          ...(profile.languagesSpoken ?? []),
          ...(profile.itSkills ?? []),
        ],
      });
    } else if (sectionId === "skills") {
      // ✨ SkillsLocationSection — เฉพาะ languagesSpoken + itSkills (work location แยก drawer)
      form.setFieldsValue({
        languagesSpoken: profile.languagesSpoken ?? [],
        itSkills: profile.itSkills ?? [],
      });
    } else if (sectionId === "work-location") {
      // ✨ WorkLocationSection — แยก Drawer 1:1 เฉพาะ preferredProvinces + canRelocate
      form.setFieldsValue({
        preferredProvinces: profile.preferredProvinces ?? [],
        canRelocate: profile.canRelocate ?? false,
      });
    } else if (sectionId === "personal-summary") {
      form.setFieldsValue({
        specialActivities: profile.specialActivities,
      });
    }
    setIsDrawerOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const values = await form.validateFields();
      const { languageAndItSkills, dateOfBirth, ...rest } = values as Record<
        string,
        unknown
      > & { languageAndItSkills?: string[]; dateOfBirth?: unknown };

      const dobStr =
        dateOfBirth !== undefined
          ? dayjs.isDayjs(dateOfBirth)
            ? (dateOfBirth as ReturnType<typeof dayjs>).format("YYYY-MM-DD")
            : ((dateOfBirth as string | undefined) ?? undefined)
          : undefined;

      // ✨ teachingSkillsSection ใช้ languageAndItSkills (combined) — เก็บใน languagesSpoken, clear itSkills
      const merged = {
        ...profile,
        ...rest,
        ...(dobStr !== undefined ? { dateOfBirth: dobStr } : {}),
        ...(languageAndItSkills !== undefined
          ? { languagesSpoken: languageAndItSkills, itSkills: [] }
          : {}),
      };
      // ✨ อัปเดต local state ทันที — ไม่รอ re-fetch (ป้องกัน race condition overwrite)
      setProfile(merged);

      if (user?.user_id) {
        // ✨ route ไปยัง 1:1 API ตาม section ที่กำลังแก้ไข
        if (editSection === "basic-info" || editSection === "personal-info") {
          await patchBasicInfo(user.user_id, {
            first_name: merged.firstName || undefined,
            last_name: merged.lastName || undefined,
            phone_number: merged.phoneNumber ?? null,
            gender: merged.gender ?? null,
            date_of_birth: dobStr ?? null,
            nationality: merged.nationality ?? null,
            profile_image_url: merged.profileImageUrl ?? null,
            profile_visibility: merged.profileVisibility,
          });
          if (editSection === "basic-info") {
            const vals = values as Record<string, unknown>;
            await patchWorkLocation(user.user_id, {
              preferred_provinces: (vals.preferredProvinces as string[]) ?? [],
              can_relocate: (vals.canRelocate as boolean) ?? false,
            });
          }
        } else if (editSection === "skills") {
          // ✨ SkillsLocationSection — เฉพาะ languagesSpoken + itSkills (work-location แยกต่างหาก)
          const vals = values as Record<string, unknown>;
          await patchSummary(user.user_id, {
            languages_spoken: (vals.languagesSpoken as string[]) ?? [],
            it_skills: (vals.itSkills as string[]) ?? [],
          });
        } else if (editSection === "work-location") {
          // ✨ WorkLocationSection — 1:1 API เฉพาะ preferred_provinces + can_relocate
          const vals = values as Record<string, unknown>;
          await patchWorkLocation(user.user_id, {
            preferred_provinces: (vals.preferredProvinces as string[]) ?? [],
            can_relocate: (vals.canRelocate as boolean) ?? false,
          });
        } else if (editSection === "teaching-skills") {
          // ✨ TeachingSkillsSection — languageAndItSkills รวม 2 อย่าง → ส่งเป็น languages_spoken, it_skills=[]
          await patchSummary(user.user_id, {
            specializations: merged.specialization ?? [],
            languages_spoken: languageAndItSkills ?? [],
            it_skills: [],
          });
        } else if (editSection === "personal-summary") {
          await patchSummary(user.user_id, {
            special_activities: merged.specialActivities ?? null,
            teaching_experience: merged.teachingExperience ?? null,
            recent_school: merged.recentSchool ?? null,
            can_relocate: merged.canRelocate,
            license_status: merged.licenseStatus || null,
            specializations: merged.specialization ?? [],
            grade_can_teaches: merged.gradeCanTeach ?? [],
            preferred_provinces: merged.preferredProvinces ?? [],
          });
        } else {
          // ✨ fallback สำหรับ section อื่น
          console.warn(
            "⚠️ [handleSave] unknown editSection fallback:",
            editSection,
          );
          await saveProfile(user.user_id);
        }

        // ✨ re-fetch เฉพาะ profileStrength — ไม่ overwrite profile ทั้งหมด
        // หมายเหตุ: ไม่ใช้ void fetchProfile ที่นี่เพื่อป้องกัน race condition overwrite local state
      }

      // ✨ sync รูปโปรไฟล์กลับไปที่ authStore
      if (
        merged.profileImageUrl &&
        merged.profileImageUrl !== user?.profile_image_url
      ) {
        updateUser({ profile_image_url: merged.profileImageUrl });
      }

      // ✨ refresh profileStrength หลัง save — ไม่ overwrite profile ทั้งหมด
      if (user?.user_id) {
        void refreshStrength(user.user_id, user.email);
      }

      setModal({
        open: true,
        type: "success",
        title: "บันทึกข้อมูลสำเร็จ",
        description: "ข้อมูลโปรไฟล์ของคุณถูกอัปเดตเรียบร้อยแล้ว",
      });
      setIsDrawerOpen(false);
      setEditSection(null);
    } catch (err) {
      // ✨ ตรวจว่าเป็น Ant Design validation error (มี errorFields) หรือ API error
      const isValidationError =
        err !== null &&
        typeof err === "object" &&
        "errorFields" in (err as object);

      if (isValidationError) {
        setModal({
          open: true,
          type: "confirm",
          title: "ข้อมูลไม่ครบถ้วน",
          description: "กรุณาตรวจสอบและกรอกข้อมูลในฟอร์มให้ครบถ้วนก่อนบันทึก",
        });
      } else {
        console.error("❌ [handleSave] API error:", err);
        setModal({
          open: true,
          type: "error",
          title: "บันทึกข้อมูลไม่สำเร็จ",
          description:
            "เกิดข้อผิดพลาดขณะบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง หากปัญหายังคงอยู่ กรุณา Capture หน้าจอนี้เพื่อแจ้งทีมงาน",
          errorDetails: err,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ✨ รอ hydration เสร็จก่อน — ป้องกัน flash redirect ตอน refresh
  if (!isMounted) return null;

  // ✨ แสดง Loading spinner ขณะโหลดข้อมูลจาก API
  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {/* ✨ YouTube-style slim top progress bar — แสดงเมื่อมี async operation */}
      <TopProgressBar active={isAvatarUploading || isSaving} />

      {/* 1. Header Banner */}
      <Flex
        style={{
          height: 224,
          position: "relative",
          overflow: "hidden",
          backgroundColor: token.colorPrimary,
        }}
      >
        <Avatar
          size={256}
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            backgroundColor: token.colorError,
            opacity: 0.8,
          }}
        />
        <Avatar
          size={128}
          style={{
            position: "absolute",
            bottom: 40,
            right: "25%",
            backgroundColor: token.colorInfo,
            opacity: 0.6,
          }}
        />
      </Flex>

      <Content>
        <Row justify="center">
          <Col span={24} style={{ maxWidth: 1152, padding: "0 24px" }}>
            <Row gutter={40}>
              {/* LEFT COLUMN */}
              <Col span={16} style={{ marginTop: -64, zIndex: 10 }}>
                {/* Header Identity Card */}
                <Card
                  variant="outlined"
                  style={{
                    borderRadius: token.borderRadiusLG,
                    marginBottom: 32,
                    boxShadow: token.boxShadowTertiary,
                    borderColor: token.colorBorderSecondary,
                  }}
                  styles={{ body: { padding: 32 } }}
                >
                  {/* ─── Hidden file input ─── */}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleAvatarFileChange}
                  />

                  <div className="flex items-start justify-between gap-4">
                    {/* ─── Avatar + Info ─── */}
                    <div className="flex items-start gap-6 flex-1 min-w-0">

                      {/* ─── Clickable Avatar ─── */}
                      <div
                        className="group relative flex-shrink-0"
                        style={{
                          width: 120,
                          height: 120,
                          cursor: isAvatarUploading ? "wait" : "pointer",
                        }}
                        onClick={() => !isAvatarUploading && avatarInputRef.current?.click()}
                      >

                        {/* Hover ring — scale in เมื่อ hover */}
                        {!isAvatarUploading && !showAvatarSuccess && (
                          <div
                            className="absolute pointer-events-none opacity-0 scale-95
                              group-hover:opacity-100 group-hover:scale-100 transition-all duration-300"
                            style={{
                              inset: -5,
                              borderRadius: "50%",
                              border: `2px dashed ${token.colorPrimary}`,
                            }}
                          />
                        )}

                        {/* Success ring */}
                        {showAvatarSuccess && (
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              inset: -4,
                              borderRadius: "50%",
                              border: `3px solid #52c41a`,
                              boxShadow: `0 0 0 3px rgba(82,196,26,0.12)`,
                            }}
                          />
                        )}

                        {/* Avatar + overlays — clipped เป็นวงกลม */}
                        <div
                          className="relative w-full h-full overflow-hidden"
                          style={{ borderRadius: "50%" }}
                        >
                          <Avatar
                            size={120}
                            shape="circle"
                            icon={<UserOutlined />}
                            src={profile.profileImageUrl || null}
                            style={{
                              width: "100%",
                              height: "100%",
                              border: `3px solid ${token.colorBgContainer}`,
                              boxShadow: token.boxShadowSecondary,
                              backgroundColor: token.colorBgLayout,
                              fontSize: 48,
                              display: "block",
                            }}
                          />

                          {/* Hover overlay — camera icon + ข้อความ slide up */}
                          {!isAvatarUploading && !showAvatarSuccess && (
                            <div
                              className="absolute inset-0 flex flex-col items-center justify-center
                                bg-transparent group-hover:bg-black/50 transition-all duration-300"
                            >
                              <span
                                className="transform translate-y-3 opacity-0
                                  group-hover:translate-y-0 group-hover:opacity-100
                                  transition-all duration-300 delay-75"
                                style={{ color: "white", fontSize: 22, lineHeight: 1 }}
                              >
                                <CameraOutlined />
                              </span>
                              <span
                                className="text-white text-xs font-medium mt-1.5
                                  transform translate-y-3 opacity-0
                                  group-hover:translate-y-0 group-hover:opacity-100
                                  transition-all duration-300 delay-100"
                              >
                                เปลี่ยนรูป
                              </span>
                            </div>
                          )}

                          {/* ✨ Linear Progress Indicator (Indeterminate) — แบบ Google ที่ขอบล่างของ avatar */}
                          {isAvatarUploading && (
                            <div
                              className="absolute left-0 right-0 bottom-0 overflow-hidden pointer-events-none"
                              style={{ height: 3, backgroundColor: `${token.colorPrimary}28` }}
                            >
                              <motion.div
                                className="absolute inset-y-0"
                                style={{ width: "35%", backgroundColor: token.colorPrimary }}
                                animate={{ x: ["-110%", "320%"] }}
                                transition={{
                                  duration: 1.6,
                                  repeat: Infinity,
                                  ease: [0.65, 0.815, 0.735, 0.395],
                                  repeatDelay: 0,
                                }}
                              />
                              <motion.div
                                className="absolute inset-y-0"
                                style={{ width: "55%", backgroundColor: token.colorPrimary, opacity: 0.45 }}
                                animate={{ x: ["-120%", "210%"] }}
                                transition={{
                                  duration: 1.6,
                                  repeat: Infinity,
                                  ease: [0.165, 0.84, 0.44, 1],
                                  delay: 0.65,
                                  repeatDelay: 0,
                                }}
                              />
                            </div>
                          )}

                          {/* Success overlay */}
                          {showAvatarSuccess && (
                            <div
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ backgroundColor: "rgba(82,196,26,0.28)" }}
                            >
                              <CheckCircleFilled style={{ color: "white", fontSize: 32 }} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ─── Profile Info ─── */}
                      <div className="flex-1 min-w-0 pt-1">
                        {/* ชื่อ-นามสกุล */}
                        <Title
                          level={2}
                          style={{ margin: 0, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em" }}
                        >
                          {profile.firstName || "—"}{" "}
                          <span style={{ color: token.colorTextSecondary, fontWeight: 600 }}>
                            {profile.lastName || ""}
                          </span>
                        </Title>

                        {/* วิชาที่เชี่ยวชาญ (ถ้ามี) */}
                        {profile.specialization?.[0] && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Tag
                              color="blue"
                              style={{ borderRadius: 999, fontSize: 12, margin: 0 }}
                            >
                              {profile.specialization[0]}
                            </Tag>
                            {profile.specialization.length > 1 && (
                              <Tag style={{ borderRadius: 999, fontSize: 12, margin: 0 }}>
                                +{profile.specialization.length - 1}
                              </Tag>
                            )}
                          </div>
                        )}

                        {/* Info row 1 — จังหวัด + อีเมล */}
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                          <span
                            className="flex items-center gap-1.5 text-sm"
                            style={{ color: token.colorTextSecondary }}
                          >
                            <EnvironmentOutlined style={{ fontSize: 13 }} />
                            {profile.preferredProvinces?.[0] || "ยังไม่ระบุจังหวัด"}
                          </span>
                          <span
                            className="flex items-center gap-1.5 text-sm"
                            style={{ color: token.colorTextSecondary }}
                          >
                            <MailOutlined style={{ fontSize: 13 }} />
                            {profile.email || user?.email || "—"}
                          </span>
                        </div>

                        {/* Info row 2 — เบอร์มือถือ + เพศ + สัญชาติ + วันเกิด (secondary tier) */}
                        {(profile.phoneNumber || profile.gender || profile.nationality || profile.dateOfBirth) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {profile.phoneNumber && (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: token.colorTextTertiary, fontSize: 12 }}
                              >
                                <PhoneOutlined style={{ fontSize: 11 }} />
                                {profile.phoneNumber}
                              </span>
                            )}
                            {profile.gender && (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: token.colorTextTertiary, fontSize: 12 }}
                              >
                                <UserOutlined style={{ fontSize: 11 }} />
                                {profile.gender}
                              </span>
                            )}
                            {profile.nationality && (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: token.colorTextTertiary, fontSize: 12 }}
                              >
                                <GlobalOutlined style={{ fontSize: 11 }} />
                                {profile.nationality}
                              </span>
                            )}
                            {profile.dateOfBirth && (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: token.colorTextTertiary, fontSize: 12 }}
                              >
                                <CalendarOutlined style={{ fontSize: 11 }} />
                                {dayjs(profile.dateOfBirth).format("DD/MM/YYYY")}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Profile link */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <LinkOutlined style={{ fontSize: 13, color: token.colorTextSecondary }} />
                          <Link href="#" style={{ fontSize: 13 }}>
                            schoolboard.com/profiles/{(profile.firstName || "").toLowerCase()}
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* ─── Edit button ─── */}
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEdit("basic-info")}
                      style={{ flexShrink: 0 }}
                    >
                      แก้ไข
                    </Button>
                  </div>
                </Card>

                <Flex vertical gap={32} style={{ width: "100%" }}>
                  {/* Personal Summary */}
                  <ProfileSectionWrapper
                    title="สรุปข้อมูลส่วนตัว"
                    onEdit={() => handleOpenEdit("personal-summary")}
                    id="personal-summary"
                  >
                    <Text style={{ fontSize: 15, lineHeight: 1.6 }}>
                      {profile.specialActivities ||
                        "ยังไม่มีข้อมูลสรุปเบื้องต้น แนะนำประสบการณ์การสอนของคุณเพื่อให้ทางโรงเรียนรู้จักคุณมากขึ้น..."}
                    </Text>
                  </ProfileSectionWrapper>

                  {/* Work Experience */}
                  <ProfileSectionWrapper
                    id="work-experience"
                    title="ประวัติการทำงาน"
                  >
                    <WorkExperienceSection />
                  </ProfileSectionWrapper>

                  {/* Education */}
                  <ProfileSectionWrapper id="education" title="ประวัติการศึกษา">
                    <EducationHistorySection />
                  </ProfileSectionWrapper>

                  {/* Teaching & Skills */}
                  <ProfileSectionWrapper
                    title="ความเชี่ยวชาญการสอนและทักษะ"
                    onEdit={() => handleOpenEdit("teaching-skills")}
                  >
                    <Flex vertical gap={24} style={{ width: "100%" }}>
                      <Flex vertical gap={12} style={{ width: "100%" }}>
                        <Text strong style={{ display: "block" }}>
                          วิชาที่เชี่ยวชาญ
                        </Text>
                        <Space size={[8, 8]} wrap>
                          {profile.specialization?.length ? (
                            profile.specialization.map((s) => (
                              <Tag
                                key={s}
                                color={token.colorPrimary}
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: 999,
                                }}
                              >
                                {s}
                              </Tag>
                            ))
                          ) : (
                            <Text type="secondary" italic>
                              ยังไม่ได้ระบุ
                            </Text>
                          )}
                        </Space>
                      </Flex>
                      <Flex vertical gap={12} style={{ width: "100%" }}>
                        <Text strong style={{ display: "block" }}>
                          ทักษะด้านภาษาและไอที
                        </Text>
                        <Space size={[8, 8]} wrap>
                          {profile.languagesSpoken?.length
                            ? profile.languagesSpoken.map((l) => (
                                <Tag
                                  key={l}
                                  icon={<EnvironmentOutlined />}
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: 999,
                                  }}
                                >
                                  {l}
                                </Tag>
                              ))
                            : null}
                          {profile.itSkills?.length
                            ? profile.itSkills.map((i) => (
                                <Tag
                                  key={i}
                                  color={token.colorWarning}
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: 999,
                                  }}
                                >
                                  {i}
                                </Tag>
                              ))
                            : null}
                          {!profile.languagesSpoken?.length &&
                            !profile.itSkills?.length && (
                              <Text type="secondary" italic>
                                ยังไม่ได้ระบุ
                              </Text>
                            )}
                        </Space>
                      </Flex>
                    </Flex>
                  </ProfileSectionWrapper>

                  {/* Resume */}
                  <ProfileSectionWrapper id="resume" title="เรซูเม่ของฉัน">
                    <ResumeUploadSection userId={user?.user_id ?? ""} />
                  </ProfileSectionWrapper>

                  {/* ใบประกอบวิชาชีพ */}
                  <ProfileSectionWrapper
                    id="teaching-license"
                    title="ใบประกอบวิชาชีพ"
                  >
                    <TeachingLicenseSection />
                  </ProfileSectionWrapper>
                </Flex>
              </Col>

              {/* RIGHT COLUMN: Sidebar */}
              <Col span={8} style={{ paddingTop: 40 }}>
                <Flex vertical gap={32} style={{ position: "sticky", top: 24 }}>
                  {/* การมองเห็นโปรไฟล์ */}
                  <Card
                    styles={{ body: { padding: 20 } }}
                    style={{ borderColor: token.colorBorderSecondary }}
                  >
                    <Flex vertical gap={12}>
                      <Text strong style={{ fontSize: 15 }}>
                        การมองเห็นโปรไฟล์
                      </Text>
                      <Radio.Group
                        value={profile.profileVisibility ?? "public"}
                        onChange={async (e) => {
                          const newVisibility = e.target.value as
                            | "public"
                            | "apply_only";
                          updateField("profileVisibility", newVisibility);
                          if (user?.user_id) {
                            try {
                              await patchBasicInfo(user.user_id, {
                                profile_visibility: newVisibility,
                              });
                            } catch (err) {
                              // ✨ rollback store ถ้า API fail
                              updateField(
                                "profileVisibility",
                                profile.profileVisibility ?? "public",
                              );
                              setModal({
                                open: true,
                                type: "error",
                                title: "บันทึกไม่สำเร็จ",
                                description:
                                  "ไม่สามารถเปลี่ยนการมองเห็นโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
                                errorDetails: err,
                              });
                            }
                          }
                        }}
                      >
                        <Flex vertical gap={12}>
                          <Radio value="public">
                            <Flex gap={6} align="center">
                              <EyeOutlined
                                style={{ color: token.colorSuccess }}
                              />
                              <Flex vertical gap={0}>
                                <Text strong style={{ fontSize: 13 }}>
                                  เปิดสาธารณะ
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  โรงเรียนสามารถค้นหาและดูโปรไฟล์ของคุณได้
                                </Text>
                              </Flex>
                            </Flex>
                          </Radio>
                          <Radio value="apply_only">
                            <Flex gap={6} align="center">
                              <LockOutlined
                                style={{ color: token.colorWarning }}
                              />
                              <Flex vertical gap={0}>
                                <Text strong style={{ fontSize: 13 }}>
                                  เฉพาะเมื่อสมัครงาน
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  โรงเรียนจะเห็นโปรไฟล์เมื่อคุณสมัครตำแหน่งงาน
                                </Text>
                              </Flex>
                            </Flex>
                          </Radio>
                        </Flex>
                      </Radio.Group>
                    </Flex>
                  </Card>

                  {/* Profile Strength */}
                  <Card
                    styles={{ body: { padding: 20 } }}
                    style={{ borderColor: token.colorBorderSecondary }}
                  >
                    <Flex vertical gap={12}>
                      {/* ── Header ── */}
                      <Flex justify="space-between" align="center">
                        <Text strong style={{ fontSize: 15 }}>
                          ความสมบูรณ์ของโปรไฟล์
                        </Text>
                        <Text
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color:
                              strengthScore >= 80
                                ? token.colorSuccess
                                : strengthScore >= 50
                                  ? token.colorWarning
                                  : token.colorError,
                          }}
                        >
                          {strengthScore}%
                        </Text>
                      </Flex>

                      {/* ── Progress Bar ── */}
                      <Progress
                        percent={strengthScore}
                        showInfo={false}
                        strokeColor={
                          strengthScore >= 80
                            ? token.colorSuccess
                            : strengthScore >= 50
                              ? token.colorWarning
                              : token.colorError
                        }
                        strokeLinecap="round"
                        style={{ margin: 0 }}
                      />

                      {/* ── Missing Fields ── */}
                      {missingFields.length > 0 ? (
                        <Flex vertical gap={6} style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            เพิ่มข้อมูลต่อไปนี้เพื่อให้โปรไฟล์สมบูรณ์:
                          </Text>
                          {missingFields.map((field) => (
                            <Flex key={field} align="center" gap={6}>
                              <ExclamationCircleFilled
                                style={{
                                  color: token.colorWarning,
                                  fontSize: 12,
                                  flexShrink: 0,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: token.colorTextSecondary,
                                }}
                              >
                                {field}
                              </Text>
                            </Flex>
                          ))}
                        </Flex>
                      ) : (
                        <Flex align="center" gap={6} style={{ marginTop: 4 }}>
                          <CheckCircleFilled
                            style={{ color: token.colorSuccess, fontSize: 14 }}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              color: token.colorSuccess,
                              fontWeight: 600,
                            }}
                          >
                            โปรไฟล์ของคุณสมบูรณ์แล้ว!
                          </Text>
                        </Flex>
                      )}
                    </Flex>
                  </Card>
                </Flex>
              </Col>
            </Row>
          </Col>
        </Row>
      </Content>

      {/* ✨ Avatar Crop Modal */}
      <AvatarCropModal
        open={isCropModalOpen}
        imageSrc={cropSrc}
        loading={isAvatarUploading}
        onCancel={() => { setIsCropModalOpen(false); setCropSrc(""); setPendingFileName(""); }}
        onConfirm={handleCropConfirm}
      />

      {/* Edit Drawer */}
      <ProfileEditDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={() => form.submit()}
        loading={false}
        title={
          editSection === "basic-info"
            ? "แก้ไขข้อมูลพื้นฐาน"
            : editSection === "personal-info"
              ? "แก้ไขข้อมูลส่วนตัว"
              : editSection === "skills"
                ? "แก้ไขทักษะด้านภาษาและไอที"
                : editSection === "work-location"
                  ? "แก้ไขสถานที่ทำงาน"
                  : editSection === "teaching-skills"
                    ? "แก้ไขความเชี่ยวชาญการสอนและทักษะ"
                    : editSection === "personal-summary"
                      ? "แก้ไขสรุปข้อมูลส่วนตัว"
                      : "แก้ไขข้อมูล"
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {editSection === "basic-info" && (
            <>
              <BasicInfoSection form={form} />
              <WorkLocationSection form={form} />
            </>
          )}
          {editSection === "personal-info" && (
            <GenderDobPhotoSection form={form} userId={user?.user_id ?? ""} />
          )}
          {editSection === "skills" && <SkillsLocationSection form={form} />}
          {editSection === "work-location" && (
            <WorkLocationSection form={form} />
          )}
          {editSection === "teaching-skills" && (
            <TeachingSkillsSection form={form} />
          )}
          {editSection === "personal-summary" && (
            <PersonalSummarySection form={form} />
          )}
        </Form>
      </ProfileEditDrawer>

      {/* ── ModalComponent: รายงานสถานะทุก action ── */}
      <ModalComponent
        open={modal.open}
        type={modal.type}
        title={modal.title}
        description={modal.description}
        errorDetails={modal.errorDetails}
        onClose={closeModal}
        onConfirm={closeModal}
      />
    </Layout>
  );
}
