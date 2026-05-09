"use client";

import { useTheme } from "@/app/contexts/theme-context";
import { useAuthStore } from "@/app/stores/auth-store";
import { useDelegatedContextStore } from "@/app/stores/delegated-context-store";
import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import {
  Badge,
  Breadcrumb,
  Button,
  Flex,
  Layout,
  Typography,
  theme,
} from "antd";
import Link from "next/link";
import { useEffect } from "react";
import { ApplicantDrawer } from "./_components/applicant-drawer";
import { FilterSection } from "./_components/filter-section";
import { InsightsCard } from "./_components/insights-card";
import { JobStatsModal } from "./_components/job-stats-modal";
import { JobsTable } from "./_components/jobs-table";
import { MyJobsSkeleton } from "./_components/my-jobs-skeleton";
import { PackageBanner } from "./_components/package-banner";
import { StatsSection } from "./_components/stats-section";
import { useApplicantDrawerStore } from "./_state/applicant-drawer-store";
import { useJobReadStore } from "./_state/job-read-store";

const { Title, Text } = Typography;
const { Content } = Layout;

// หน้าจัดการประกาศรับสมัครครู — สำหรับฝ่ายบุคลากรของโรงเรียน
export default function MyJobsPage() {
  const { mode } = useTheme();
  const { jobs, isLoading, fetchJobs, fetchPipelineData } = useJobReadStore();
  const { openNewApplicantsDrawer } = useApplicantDrawerStore();
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const { active: delegatedActive } = useDelegatedContextStore();
  const totalNewApplicants = jobs.reduce((sum, j) => sum + j.newApplicants, 0);

  // ✨ โหลดข้อมูลงานและ pipeline — ถ้ามี delegated context ให้ดึงงานของโรงเรียนนั้นแทน
  useEffect(() => {
    if (user?.user_id) {
      fetchJobs(user.user_id, delegatedActive?.schoolProfileId);
      fetchPipelineData(user.user_id);
    }
  }, [user?.user_id, delegatedActive?.schoolProfileId, fetchJobs, fetchPipelineData]);

  return (
    <Layout
      style={{
        minHeight: "100vh",
        backgroundColor: token.colorBgLayout,
        paddingBottom: 80,
      }}
    >
      {/* Gradient Hero Header */}
      <Flex
        vertical
        style={{
          background: mode === "dark" 
            ? token.colorBgBase 
            : `linear-gradient(135deg, ${token.colorPrimary} 0%, #0878a8 100%)`,
          borderBottom: mode === "dark" ? `1px solid ${token.colorBorder}` : "none",
          padding: "32px 0 56px",
        }}
      >
        <Flex
          vertical
          gap={20}
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            width: "100%",
          }}
        >
          <Breadcrumb
            items={[
              {
                title: (
                  <Link
                    href="/pages/employer"
                    style={{ color: mode === "dark" ? token.colorTextSecondary : "rgba(255,255,255,0.65)" }}
                  >
                    แดชบอร์ด
                  </Link>
                ),
              },
              {
                title: (
                  <span style={{ color: mode === "dark" ? token.colorText : "rgba(255,255,255,0.9)" }}>
                    ประกาศรับสมัครครู
                  </span>
                ),
              },
            ]}
          />

          <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
            {/* Title Block */}
            <Flex gap={16} align="center">
              <Flex
                align="center"
                justify="center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: mode === "dark" ? token.colorBgContainer : "rgba(255,255,255,0.2)",
                  border: `1px solid ${mode === "dark" ? token.colorBorder : "rgba(255,255,255,0.3)"}`,
                  flexShrink: 0,
                }}
              >
                <TeamOutlined style={{ fontSize: 26, color: mode === "dark" ? token.colorPrimary : "#fff" }} />
              </Flex>
              <Flex vertical gap={3}>
                <Title
                  level={2}
                  style={{ margin: 0, color: mode === "dark" ? token.colorText : "#fff", lineHeight: 1.2 }}
                >
                  ประกาศรับสมัครครู
                </Title>
                <Text style={{ color: mode === "dark" ? token.colorTextSecondary : "rgba(255,255,255,0.75)", fontSize: 14 }}>
                  จัดการและติดตามประกาศรับสมัครบุคลากรของโรงเรียน
                </Text>
              </Flex>
            </Flex>

            {/* Action Buttons */}
            <Flex gap={12} align="center">
              {totalNewApplicants > 0 && (
                <Badge
                  count={totalNewApplicants}
                  size="default"
                  offset={[-4, 4]}
                >
                  <Button
                    size="large"
                    onClick={() => openNewApplicantsDrawer(user?.user_id ?? "")}
                    style={{
                      borderRadius: 10,
                      background: mode === "dark" ? token.colorBgElevated : "rgba(255,255,255,0.15)",
                      border: `1px solid ${mode === "dark" ? token.colorBorder : "rgba(255,255,255,0.35)"}`,
                      color: mode === "dark" ? token.colorText : "#fff",
                      fontWeight: 600,
                    }}
                  >
                    ผู้สมัครใหม่
                  </Button>
                </Badge>
              )}
              <Link href="/pages/employer/job/post">
                <Button
                  size="large"
                  icon={<PlusOutlined />}
                  type={mode === "dark" ? "primary" : "default"}
                  style={{
                    borderRadius: 10,
                    background: mode === "dark" ? token.colorPrimary : "#fff",
                    color: mode === "dark" ? "#fff" : token.colorPrimary,
                    border: "none",
                    fontWeight: 700,
                    boxShadow: mode === "dark" ? "none" : "0 4px 16px rgba(0,0,0,0.15)",
                  }}
                >
                  ลงประกาศงานใหม่
                </Button>
              </Link>
            </Flex>
          </Flex>
        </Flex>
      </Flex>

      {/* Main Content — overlaps header by pulling up */}
      <Content>
        {isLoading ? (
          <MyJobsSkeleton />
        ) : (
          <Flex
            vertical
            gap={24}
            style={{
              maxWidth: 1200,
              margin: "-32px auto 0",
              padding: "0 24px 0",
            }}
          >
            {/* ✨ Package Banner — ดึงข้อมูลจาก DB real-time, Admin เปลี่ยนได้จากหลังบ้าน */}
            {user?.user_id && <PackageBanner userId={user.user_id} />}
            <StatsSection />
            <InsightsCard />
            <FilterSection />
            <JobsTable />
          </Flex>
        )}
      </Content>

      {/* Drawer แสดงรายชื่อผู้สมัครของตำแหน่งที่เลือก */}
      <ApplicantDrawer />

      {/* Modal แสดงสถิติเชิงลึกของตำแหน่งที่เลือก */}
      <JobStatsModal />
    </Layout>
  );
}
