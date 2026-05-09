import axios from "axios";

// API response shape จาก backend
interface ApiResponse<T> {
  status_code: number;
  message_th: string;
  message_en: string;
  data: T;
}

// ✨ สร้างประกาศงานใหม่
export const requestCreateJob = async (
  userId: string,
  payload: Record<string, unknown>,
) => {
  const { data } = await axios.post<ApiResponse<{ id: string }>>(
    `/api/v1/employer/jobs/create?user_id=${userId}`,
    payload,
  );
  return data;
};

// ✨ แก้ไขประกาศงานที่มีอยู่
export const requestUpdateJob = async (
  userId: string,
  jobId: string,
  payload: Record<string, unknown>,
) => {
  const { data } = await axios.patch<ApiResponse<{ id: string }>>(
    `/api/v1/employer/jobs/update?user_id=${userId}&job_id=${jobId}`,
    payload,
  );
  return data;
};

// ✨ ดึง config options ตาม group (ใช้สำหรับ dropdown ที่ admin กำหนด)
export interface ConfigOption {
  id: string;
  label: string;
  value: string;
  parentValue: string | null;
  sortOrder: number;
}

export const requestFetchConfigOptions = async (group: string): Promise<ConfigOption[]> => {
  const { data } = await axios.get<ApiResponse<ConfigOption[]>>(
    `/api/v1/config/options?group=${group}`,
  );
  return data.data ?? [];
};

// ✨ auto-suggest ตำแหน่งงานใหม่ที่ยังไม่มีใน config
// ถ้ามีอยู่แล้ว API จะ return ของเดิม ถ้าไม่มีจะสร้างใหม่
export const requestSuggestPosition = async (
  label: string,
  parentValue: string | null = null,
): Promise<ConfigOption> => {
  const { data } = await axios.post<ApiResponse<ConfigOption>>(
    `/api/v1/config/options`,
    { group: "job_position", label, parent_value: parentValue },
  );
  return data.data;
};

// ✨ ดึงข้อมูลประกาศงานตาม ID
export const requestFetchJobById = async (userId: string, jobId: string) => {
  const { data } = await axios.get<ApiResponse<Record<string, unknown>>>(
    `/api/v1/employer/jobs/read?user_id=${userId}&job_id=${jobId}`,
  );
  return data.data;
};
