import { create } from "zustand";
import {
  fetchJobList,
  fetchPipeline,
  requestCloseJob,
} from "../_api/job-read-api";

export interface JobRecord {
  key: string;
  title: string;
  subjects: string[];
  grades: string[];
  publishedAt: string;
  expiresAt: string;
  status: "ACTIVE" | "CLOSED" | "DRAFT";
  views: number;
  applicants: number;
  newApplicants: number;
  conversionRate: string;
  salary: string;
}

export interface PipelineData {
  totalApplicants: number;
  pending: number;
  interview: number;
  accepted: number;
  rejected: number;
  totalVacancies: number;
  urgentJobs: {
    jobId: string;
    title: string;
    type: "new_applicants" | "expiring_soon" | "pending_interview";
    count: number;
  }[];
}

// ✨ แปลงข้อมูลจาก DB → JobRecord สำหรับ UI
const mapDbJobToRecord = (job: Record<string, unknown>): JobRecord => {
  const subjects = ((job.jobSubjects as { subject: string }[]) ?? []).map(
    (s) => s.subject,
  );
  const grades = ((job.jobGrades as { grade: string }[]) ?? []).map(
    (g) => g.grade,
  );

  const min = job.salaryMin as number | null;
  const max = job.salaryMax as number | null;
  const negotiable = job.salaryNegotiable as boolean;
  let salary = "ตามตกลง";
  if (!negotiable && min && max) {
    salary = `${min.toLocaleString()} - ${max.toLocaleString()} บาท`;
  } else if (!negotiable && min) {
    salary = `${min.toLocaleString()} บาท`;
  }

  const statusRaw = job.status as string;
  const status: JobRecord["status"] =
    statusRaw === "OPEN"
      ? "ACTIVE"
      : statusRaw === "CLOSED"
        ? "CLOSED"
        : "DRAFT";

  const createdAt = job.createdAt as string | null;
  const deadline = job.deadline as string | null;

  // ✨ นับ applicants จาก _count (จาก backend ใหม่)
  const countObj = job._count as { applications?: number; jobViews?: number } | undefined;
  const applicants = countObj?.applications ?? 0;
  const views = countObj?.jobViews ?? 0;
  // ✨ นับผู้สมัครใหม่ใน 7 วัน
  const recentApplications = (job.applications as { id: string }[]) ?? [];
  const newApplicants = recentApplications.length;

  return {
    key: job.id as string,
    title: job.title as string,
    subjects,
    grades,
    publishedAt: createdAt
      ? new Date(createdAt).toISOString().split("T")[0]
      : "-",
    expiresAt: deadline ? new Date(deadline).toISOString().split("T")[0] : "-",
    status,
    views,
    applicants,
    newApplicants,
    conversionRate: "0%",
    salary,
  };
};

interface JobReadState {
  jobs: JobRecord[];
  pipeline: PipelineData | null;
  searchKeyword: string;
  activeTab: string;
  isLoading: boolean;
  isPipelineLoading: boolean;
  setJobs: (jobs: JobRecord[]) => void;
  setSearchKeyword: (keyword: string) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  fetchJobs: (userId: string, delegatedSchoolProfileId?: string | null) => Promise<void>;
  fetchPipelineData: (userId: string) => Promise<void>;
  closeJob: (userId: string, jobId: string) => Promise<void>;
}

export const useJobReadStore = create<JobReadState>((set, get) => ({
  jobs: [],
  pipeline: null,
  searchKeyword: "",
  activeTab: "ACTIVE",
  isLoading: false,
  isPipelineLoading: false,
  setJobs: (jobs) => set({ jobs }),
  setSearchKeyword: (searchKeyword) => set({ searchKeyword }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLoading: (isLoading) => set({ isLoading }),

  // ✨ โหลดรายการประกาศงานจาก API จริง
  // delegatedSchoolProfileId: ระบุเมื่อ EMPLOYER ทำงานแทนโรงเรียนอื่น
  fetchJobs: async (userId: string, delegatedSchoolProfileId?: string | null) => {
    set({ isLoading: true });
    try {
      const rawList = await fetchJobList(userId, delegatedSchoolProfileId);
      const jobs = (rawList as Record<string, unknown>[]).map(mapDbJobToRecord);
      set({ jobs });
    } catch (err) {
      console.error("❌ [job-read-store] fetchJobs error:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ✨ โหลดข้อมูล Pipeline สำหรับ InsightsCard
  fetchPipelineData: async (userId: string) => {
    set({ isPipelineLoading: true });
    try {
      const data = await fetchPipeline(userId);
      set({ pipeline: data as PipelineData });
    } catch (err) {
      console.error("❌ [job-read-store] fetchPipeline error:", err);
    } finally {
      set({ isPipelineLoading: false });
    }
  },

  // ✨ ปิดรับสมัครประกาศงาน แล้ว refresh รายการ
  closeJob: async (userId: string, jobId: string) => {
    await requestCloseJob(userId, jobId);
    await get().fetchJobs(userId);
    await get().fetchPipelineData(userId);
  },
}));
