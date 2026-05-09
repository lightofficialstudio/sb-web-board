import axios from "axios";

// API response shape
interface ApiResponse<T> {
  status_code: number;
  message_th: string;
  message_en: string;
  data: T;
}

// ✨ ดึงรายการประกาศงานทั้งหมดของ Employer (รวม application count)
// ถ้า delegatedSchoolProfileId ระบุมา → ดึงงานของโรงเรียนที่ถูก delegate แทน
export const fetchJobList = async (
  userId: string,
  delegatedSchoolProfileId?: string | null,
) => {
  const params = new URLSearchParams({ user_id: userId });
  if (delegatedSchoolProfileId) {
    params.set("school_profile_id", delegatedSchoolProfileId);
  }
  const { data } = await axios.get<ApiResponse<unknown[]>>(
    `/api/v1/employer/jobs/read?${params.toString()}`,
  );
  return data.data ?? [];
};

// ดึงสรุป Pipeline การรับสมัครทั้งหมด
export const fetchPipeline = async (userId: string) => {
  const { data } = await axios.get<ApiResponse<unknown>>(
    `/api/v1/employer/jobs/pipeline?user_id=${userId}`,
  );
  return data.data;
};

// ปิดรับสมัครประกาศงาน
export const requestCloseJob = async (userId: string, jobId: string) => {
  const { data } = await axios.patch<ApiResponse<unknown>>(
    `/api/v1/employer/jobs/close?user_id=${userId}&job_id=${jobId}`,
  );
  return data;
};

// ดึงรายชื่อผู้สมัครของตำแหน่งงาน
export const fetchApplicantsByJob = async (userId: string, jobId: string) => {
  const { data } = await axios.get<ApiResponse<unknown[]>>(
    `/api/v1/employer/jobs/applicants/read?user_id=${userId}&job_id=${jobId}`,
  );
  return data.data ?? [];
};

// ดึงผู้สมัครใหม่ทุกตำแหน่ง (PENDING ใน 7 วันล่าสุด)
export const fetchNewApplicants = async (userId: string) => {
  const { data } = await axios.get<ApiResponse<unknown[]>>(
    `/api/v1/employer/jobs/applicants/read?user_id=${userId}&mode=new`,
  );
  return data.data ?? [];
};

// ดึงสถิติเชิงลึกของตำแหน่งงาน
export const fetchJobStats = async (userId: string, jobId: string) => {
  const { data } = await axios.get<ApiResponse<unknown>>(
    `/api/v1/employer/jobs/stats/read?user_id=${userId}&job_id=${jobId}`,
  );
  return data.data;
};

// อัปเดตสถานะผู้สมัคร
export const requestUpdateApplicantStatus = async (
  userId: string,
  applicationId: string,
  status: "PENDING" | "INTERVIEW" | "ACCEPTED" | "REJECTED",
) => {
  const { data } = await axios.patch<ApiResponse<unknown>>(
    `/api/v1/employer/jobs/applicants/update-status`,
    { user_id: userId, application_id: applicationId, status },
  );
  return data;
};
