"use client";

import { useAuthStore } from "@/app/stores/auth-store";
import { useNotificationModalStore } from "@/app/stores/notification-modal-store";
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  theme as antTheme,
  Breadcrumb,
  Button,
  Col,
  Flex,
  Form,
  Layout,
  Row,
  Skeleton,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  requestCreateJob,
  requestFetchJobById,
  requestSuggestPosition,
  requestUpdateJob,
} from "./_api/job-post-api";
import { BasicInfoSection } from "./_components/basic-info-section";
import { JobDetailSection } from "./_components/job-detail-section";
import { JobTipsSidebar } from "./_components/job-tips-sidebar";
import { loadAll, LocationSection } from "./_components/location-section";
import { PostJobSkeleton } from "./_components/post-job-skeleton";
import { PostSettingsSection } from "./_components/post-settings-section";
import { SalarySection } from "./_components/salary-section";
import { useJobPostStore } from "./_stores/job-post-store";

const { Title } = Typography;
const { Content } = Layout;

// ✨ เปิด/ปิดปุ่มสุ่มข้อมูล (สำหรับ Dev/Testing เท่านั้น)
const SHOW_MOCK_BUTTON = true;

const MOCK_PRESETS = [
  {
    title: "ครูภาษาอังกฤษ (Full-time)",
    employmentType: "FULL_TIME",
    vacancyCount: 2,
    subjects: ["ภาษาอังกฤษ", "Conversation"],
    grades: ["มัธยมต้น", "มัธยมปลาย"],
    salary_type: "SPECIFY",
    salaryFrom: 25000,
    salaryTo: 35000,
    description:
      "รับผิดชอบการสอนภาษาอังกฤษพื้นฐานและเพื่อการสื่อสาร มีทักษะการจัดการชั้นเรียนที่ดี",
    educationLevel: "ปริญญาตรีขึ้นไป",
    experience: "1 - 3 ปี",
    license: "จำเป็นต้องมี",
    gender: "ไม่จำกัด",
    qualifications: "มีอัธยาศัยดี สอนสนุก รักเด็ก",
    province: "กรุงเทพมหานคร",
    area: "เขตบางนา",
    address: "เลขที่ 123 ถ.บางนา กรุงเทพฯ",
    duration: 30,
    status: true,
  },
  {
    title: "ครูคณิตศาสตร์ (Part-time)",
    employmentType: "PART_TIME",
    vacancyCount: 1,
    subjects: ["คณิตศาสตร์", "สถิติ"],
    grades: ["ประถมปลาย", "มัธยมต้น"],
    salary_type: "NEGOTIABLE",
    salaryFrom: null,
    salaryTo: null,
    description:
      "สอนคณิตศาสตร์ให้นักเรียนระดับประถมและมัธยม เน้นการสอนแบบ Problem-based Learning",
    educationLevel: "ปริญญาตรีขึ้นไป",
    experience: "ไม่ระบุ",
    license: "ไม่จำเป็น",
    gender: "ไม่จำกัด",
    qualifications: "มีความรู้ด้านคณิต เตรียมสื่อการสอนได้เอง",
    province: "เชียงใหม่",
    area: "อำเภอเมือง",
    address: "99 ถ.นิมมานเหมินท์ เชียงใหม่",
    duration: 14,
    status: false,
  },
  {
    title: "ครูวิทยาศาสตร์ระดับประถม",
    employmentType: "FULL_TIME",
    vacancyCount: 3,
    subjects: ["วิทยาศาสตร์", "ชีววิทยา"],
    grades: ["ประถมต้น", "ประถมปลาย"],
    salary_type: "RANGE",
    salaryFrom: 18000,
    salaryTo: 28000,
    description:
      "ดูแลการเรียนการสอนวิชาวิทยาศาสตร์ระดับประถมศึกษา ส่งเสริมการคิดวิเคราะห์และทดลองวิทยาศาสตร์",
    educationLevel: "ปริญญาตรีขึ้นไป",
    experience: "0 - 1 ปี",
    license: "จำเป็นต้องมี",
    gender: "หญิง",
    qualifications: "รักเด็ก อดทน สื่อสารดี",
    province: "ขอนแก่น",
    area: "อำเภอเมือง",
    address: "55/1 ถ.มิตรภาพ ขอนแก่น",
    duration: 60,
    status: true,
  },
];

export default function PostJobPage() {
  const [form] = Form.useForm();
  const router = useRouter();
  const params = useParams();
  const { token } = antTheme.useToken();
  const { user } = useAuthStore();
  const { openNotification } = useNotificationModalStore();
  const jobId = params?.id as string | undefined;
  const isEdit = !!jobId;
  const {
    setSalaryType,
    setSubmitting,
    isSubmitting,
    setSelectedProvinceId,
    setSelectedDistrictId,
    positionOptions,
    addPositionOption,
  } = useJobPostStore();
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [isMockLoading, setIsMockLoading] = useState(false);

  // ✨ สุ่มข้อมูล preset สำหรับทดสอบ (รวมสถานที่จากข้อมูลจริง)
  const handleFillMockData = async () => {
    setIsMockLoading(true);
    try {
      const preset =
        MOCK_PRESETS[Math.floor(Math.random() * MOCK_PRESETS.length)];
      const { provinces, districts, subDistricts } = await loadAll();

      // สุ่มจังหวัด → อำเภอ → ตำบล
      const province = provinces[Math.floor(Math.random() * provinces.length)];
      const provDistricts = districts.filter(
        (d) => d.province_id === province.id,
      );
      const district =
        provDistricts[Math.floor(Math.random() * provDistricts.length)];
      const distSubs = subDistricts.filter(
        (s) => s.district_id === district.id,
      );
      const sub = distSubs[Math.floor(Math.random() * distSubs.length)];

      // อัปเดต store ก่อน (เพื่อให้ LocationSection re-render ถูก)
      setSelectedProvinceId(province.id);
      setSelectedDistrictId(district.id);

      form.setFieldsValue({
        ...preset,
        province: province.name_th,
        area: district.name_th,
        sub_district: sub?.name_th ?? undefined,
        zipcode: sub?.zip_code ? String(sub.zip_code) : undefined,
      });
      setSalaryType(preset.salary_type);
    } finally {
      setIsMockLoading(false);
    }
  };

  // ✨ โหลดข้อมูลงานที่ต้องการแก้ไขจาก API จริง
  useEffect(() => {
    if (!isEdit || !jobId || !user?.user_id) return;
    (async () => {
      setIsLoadingJob(true);
      try {
        const data = await requestFetchJobById(user.user_id, jobId);
        if (data) {
          // map DB fields กลับเป็น form fields
          form.setFieldsValue({
            title: data.title,
            employmentType: data.jobType,
            vacancyCount: data.positionsAvailable,
            subjects:
              (data.jobSubjects as { subject: string }[])?.map(
                (s) => s.subject,
              ) ?? [],
            grades:
              (data.jobGrades as { grade: string }[])?.map((g) => g.grade) ??
              [],
            salary_type: data.salaryNegotiable
              ? "NEGOTIABLE"
              : data.salaryMin && data.salaryMax
                ? "RANGE"
                : "SPECIFY",
            salaryFrom: data.salaryMin,
            salaryTo: data.salaryMax,
            description: data.description,
            province: data.province,
            area: data.district,
            duration: 30,
            status: data.status === "PUBLISHED",
          });
          if (data.salaryNegotiable) setSalaryType("NEGOTIABLE");
        }
      } catch (err) {
        console.error("❌ [PostJobPage] โหลดข้อมูลงานไม่สำเร็จ:", err);
      } finally {
        setIsLoadingJob(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, jobId, user?.user_id]);

  // ✨ แปลง form values → API payload (snake_case)
  const toApiPayload = (values: Record<string, unknown>) => ({
    title: (values.titleLabel as string) || (values.title as string),
    employment_type: values.employmentType ?? null,
    vacancy_count: values.vacancyCount ?? 1,
    subjects: typeof values.subjects === "string" ? [values.subjects] : [],
    grades: (values.grades as string[]) ?? [],
    salary_type: values.salary_type ?? "SPECIFY",
    salary_min: values.salaryFrom ?? null,
    salary_max: values.salaryTo ?? null,
    salary_negotiable: values.salary_type === "NEGOTIABLE",
    description: values.description ?? null,
    education_level: values.educationLevel ?? null,
    experience: values.experience ?? null,
    license: values.license ?? null,
    gender: values.gender ?? null,
    qualifications: values.qualifications ?? null,
    province: values.province,
    area: values.area ?? null,
    address: values.address ?? null,
    deadline_days: values.duration ?? null,
    is_published: values.status === true,
    benefits: (values.benefits as string[]) ?? [],
  });

  // ✨ บันทึกข้อมูลเมื่อกด Submit
  const onFinish = async (values: Record<string, unknown>) => {
    if (!user?.user_id) {
      openNotification({
        type: "error",
        mainTitle: "ไม่พบข้อมูลผู้ใช้",
        description: "กรุณาเข้าสู่ระบบใหม่",
        icon: <CloseCircleFilled style={{ color: token.colorError }} />,
      });
      return;
    }

    setSubmitting(true);
    try {
      // ✨ ถ้า title เป็น free text ที่ไม่มีใน config → auto-suggest ก่อน submit
      const titleValue = (values.title as string) ?? "";
      const isKnownPosition = positionOptions.some(
        (o) => o.label === titleValue || o.value === titleValue,
      );
      if (titleValue && !isKnownPosition) {
        try {
          const created = await requestSuggestPosition(titleValue, null);
          addPositionOption(created);
        } catch {
          // ✨ suggest ล้มเหลว — ยังคง submit job ด้วย free text ได้
        }
      }

      const payload = toApiPayload(values);

      if (isEdit && jobId) {
        await requestUpdateJob(user.user_id, jobId, payload);
      } else {
        await requestCreateJob(user.user_id, payload);
      }

      openNotification({
        type: "success",
        mainTitle: isEdit ? "แก้ไขประกาศงานสำเร็จ" : "ลงประกาศงานสำเร็จ",
        description: isEdit
          ? "ข้อมูลประกาศงานถูกอัปเดตเรียบร้อยแล้ว"
          : "ประกาศงานของคุณถูกเผยแพร่เรียบร้อยแล้ว",
        icon: <CheckCircleFilled style={{ color: token.colorSuccess }} />,
      });
      router.push("/pages/employer/job/read");
    } catch (err) {
      console.error("❌ [PostJobPage] บันทึกงานไม่สำเร็จ:", err);
      openNotification({
        type: "error",
        mainTitle: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
        icon: <CloseCircleFilled style={{ color: token.colorError }} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoadingJob || isMockLoading) {
    return (
      <Layout
        style={{
          minHeight: "100vh",
          backgroundColor: token.colorBgLayout,
          paddingBottom: 100,
        }}
      >
        <Flex
          vertical
          style={{
            backgroundColor: token.colorBgContainer,
            padding: "16px 0 24px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              maxWidth: 1152,
              margin: "12px auto 0",
              padding: "0 24px",
              width: "100%",
            }}
          >
            <Skeleton
              active
              title={false}
              paragraph={{ rows: 1 }}
              style={{ width: 200, marginBottom: 16 }}
            />
            <Skeleton active title paragraph={false} style={{ width: "40%" }} />
          </div>
        </Flex>
        <Content>
          <PostJobSkeleton />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout
      style={{
        minHeight: "100vh",
        backgroundColor: token.colorBgLayout,
        paddingBottom: 100,
      }}
    >
      {/* Header Navigation */}
      <Flex
        vertical
        style={{
          backgroundColor: token.colorBgContainer,
          padding: "16px 0 24px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          marginBottom: 40,
        }}
      >
        <Flex
          vertical
          gap={16}
          style={{
            maxWidth: 1152,
            margin: "0 auto",
            padding: "0 24px",
            width: "100%",
          }}
        >
          <Breadcrumb
            items={[
              { title: <Link href="/pages/employer">แดชบอร์ด</Link> },
              { title: <Link href="/pages/employer/job/read">งานของฉัน</Link> },
              { title: isEdit ? "แก้ไขประกาศงาน" : "ลงประกาศงานใหม่" },
            ]}
          />
          <Flex align="center" gap={12}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
            />
            <Title level={2} style={{ margin: 0 }}>
              {isEdit ? "แก้ไขประกาศงาน" : "ลงประกาศงานใหม่"} (School Board)
            </Title>
            {SHOW_MOCK_BUTTON && !isEdit && (
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={handleFillMockData}
                style={{ marginLeft: "auto", borderStyle: "dashed" }}
              >
                สุ่มข้อมูล
              </Button>
            )}
          </Flex>
        </Flex>
      </Flex>

      {/* Main Content */}
      <Content>
        <Flex style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              vacancyCount: 1,
              salary_type: "SPECIFY",
              duration: 30,
              status: true,
            }}
            scrollToFirstError
            style={{ width: "100%" }}
          >
            <Row gutter={40}>
              <Col xs={24} lg={16}>
                <Space
                  orientation="vertical"
                  size={24}
                  style={{ width: "100%" }}
                >
                  <BasicInfoSection />
                  <SalarySection />
                  <JobDetailSection />
                  <LocationSection />
                  <PostSettingsSection />
                  <Flex justify="flex-end" gap={16} style={{ marginTop: 8 }}>
                    <Button
                      size="large"
                      style={{ minWidth: 120 }}
                      onClick={() => router.back()}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      loading={isSubmitting}
                      style={{ minWidth: 200, fontWeight: 600 }}
                    >
                      {isEdit ? "บันทึกการแก้ไข" : "ยืนยันการลงประกาศงาน"}
                    </Button>
                  </Flex>
                </Space>
              </Col>
              <Col xs={0} lg={8}>
                <JobTipsSidebar isEdit={isEdit} />
              </Col>
            </Row>
          </Form>
        </Flex>
      </Content>
    </Layout>
  );
}
