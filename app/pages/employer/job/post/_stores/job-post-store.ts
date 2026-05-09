import { create } from "zustand";

// ประเภทข้อมูลฟอร์มลงประกาศงาน
interface JobFormData {
  title?: string;
  employmentType?: string;
  vacancyCount?: number;
  subjects?: string[];
  grades?: string[];
  salary_type?: string;
  salaryFrom?: number;
  salaryTo?: number;
  description?: string;
  educationLevel?: string;
  experience?: string;
  license?: string;
  gender?: string;
  qualifications?: string;
  province?: string;
  area?: string;
  address?: string;
  duration?: number;
  status?: boolean;
}

// ✨ ConfigOption shape สำหรับใช้ใน store (ไม่ import จาก _api เพื่อ decouple)
export interface PositionOption {
  id: string;
  label: string;
  value: string;
  parentValue: string | null;
  sortOrder: number;
}

interface JobPostState {
  isSubmitting: boolean;
  salaryType: string;
  initialFormData: JobFormData | null;
  // ✨ สำหรับ cascade dropdown ของ LocationSection
  selectedProvinceId: number | null;
  selectedDistrictId: number | null;
  // ✨ รายการตำแหน่งงานจาก config — ใช้ใน page.tsx เพื่อ suggest ก่อน submit
  positionOptions: PositionOption[];
  setSalaryType: (type: string) => void;
  setSubmitting: (submitting: boolean) => void;
  setInitialFormData: (data: JobFormData | null) => void;
  setSelectedProvinceId: (id: number | null) => void;
  setSelectedDistrictId: (id: number | null) => void;
  setPositionOptions: (options: PositionOption[]) => void;
  addPositionOption: (option: PositionOption) => void;
  reset: () => void;
}

export const useJobPostStore = create<JobPostState>((set) => ({
  isSubmitting: false,
  salaryType: "SPECIFY",
  initialFormData: null,
  selectedProvinceId: null,
  selectedDistrictId: null,
  positionOptions: [],
  setSalaryType: (salaryType) => set({ salaryType }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setInitialFormData: (initialFormData) => set({ initialFormData }),
  setSelectedProvinceId: (selectedProvinceId) => set({ selectedProvinceId }),
  setSelectedDistrictId: (selectedDistrictId) => set({ selectedDistrictId }),
  setPositionOptions: (positionOptions) => set({ positionOptions }),
  addPositionOption: (option) =>
    set((state) => ({ positionOptions: [...state.positionOptions, option] })),
  reset: () =>
    set({
      isSubmitting: false,
      salaryType: "SPECIFY",
      initialFormData: null,
      selectedProvinceId: null,
      selectedDistrictId: null,
      positionOptions: [],
    }),
}));
