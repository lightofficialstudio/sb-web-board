import { create } from "zustand";
import {
  requestUpdateEmployeeProfile,
  responseEmployeeProfile,
} from "../_api/employee-profile-api";

// Work Experience Type
export interface WorkExperienceEntry {
  id?: string;
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  inPresent: boolean;
  description: string;
  workYear?: number;
  isDeleted?: boolean;
}

// Education Type
export interface EducationEntry {
  id?: string;
  level: string;
  institution: string;
  major: string;
  graduationYear?: number; // ปีที่สำเร็จการศึกษา (พ.ศ.)
  gpa?: number;
  startDate?: string;
  endDate?: string;
  isDeleted?: boolean;
}

// License/Certification Type
export interface LicenseEntry {
  id?: string;
  licenseName: string;
  issuer?: string;
  licenseNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialUrl?: string;
  isDeleted?: boolean;
}

// Language Type
export interface LanguageEntry {
  id?: string;
  languageName: string;
  proficiency?: string;
  isDeleted?: boolean;
}

// Skill Type
export interface SkillEntry {
  id?: string;
  skillName: string;
  endorsements?: number;
  isDeleted?: boolean;
}

// Resume Type — รองรับแนบได้หลายไฟล์ และเลือกเรซูเม่ที่กำลังใช้งาน
export interface ResumeEntry {
  id: string; // unique id ของไฟล์
  fileName: string; // ชื่อไฟล์
  fileSize: number; // ขนาดไฟล์ (bytes)
  uploadedAt: string; // วันที่อัพโหลด
  url?: string; // URL สำหรับดาวน์โหลด (จาก API)
  file?: File; // ไฟล์จริงก่อน upload
}

interface EmployeeProfile {
  // Basic info
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  profileImageFile?: File;
  profileImageUrl?: string;

  // Education (main, for compatibility)
  educationLevel: string;
  institution: string;
  major: string;
  gpa: number | string;
  teachingLicense: string;
  licenseFile?: File;
  licenseFileUrl?: string;
  // สถานะใบประกอบวิชาชีพและไฟล์แนบ
  licenseStatus: "has_license" | "pending" | "no_license" | "not_required" | "";
  licenseAttachments: ResumeEntry[]; // ใช้ ResumeEntry type เดิม

  // Teaching info
  specialization: string[];
  gradeCanTeach: string[];
  teachingExperience: string;
  recentSchool: string;

  // Skills (tags)
  languagesSpoken: string[];
  itSkills: string[];
  specialActivities: string;

  // Work location
  preferredProvinces: string[];
  canRelocate: boolean;

  // การมองเห็นโปรไฟล์
  profileVisibility: "public" | "apply_only";

  // ความสมบูรณ์ของโปรไฟล์ — คำนวณโดย API
  profileStrength?: { score: number; missingFields: string[] };

  // Resume — รองรับหลายไฟล์ + เลือก active
  resumes: ResumeEntry[];
  activeResumeId: string | null; // id ของเรซูเม่ที่กำลังใช้งาน

  // Relations (arrays of entries)
  workExperiences: WorkExperienceEntry[];
  educations: EducationEntry[];
  licenses: LicenseEntry[];
  languages: LanguageEntry[];
  skills: SkillEntry[];
}

interface ProfileStore {
  profile: Partial<EmployeeProfile>;
  setProfile: (profile: Partial<EmployeeProfile>) => void;
  updateField: (field: keyof EmployeeProfile, value: any) => void;
  resetProfile: () => void;

  // Work Experience helpers
  addWorkExperience: (experience: WorkExperienceEntry) => void;
  updateWorkExperience: (
    index: number,
    experience: WorkExperienceEntry,
  ) => void;
  removeWorkExperience: (index: number) => void;

  // Education helpers
  addEducation: (education: EducationEntry) => void;
  updateEducation: (index: number, education: EducationEntry) => void;
  removeEducation: (index: number) => void;

  // License helpers
  addLicense: (license: LicenseEntry) => void;
  updateLicense: (index: number, license: LicenseEntry) => void;
  removeLicense: (index: number) => void;

  // Language helpers
  addLanguage: (language: LanguageEntry) => void;
  updateLanguage: (index: number, language: LanguageEntry) => void;
  removeLanguage: (index: number) => void;

  // Skill helpers
  addSkill: (skill: SkillEntry) => void;
  updateSkill: (index: number, skill: SkillEntry) => void;
  removeSkill: (index: number) => void;

  // Resume helpers
  addResume: (resume: ResumeEntry) => void;
  removeResume: (id: string) => void;
  setActiveResume: (id: string) => void;
  deleteResumeFromDB: (resumeId: string) => Promise<void>;

  // License attachment helpers
  addLicenseAttachment: (file: ResumeEntry) => void;
  removeLicenseAttachment: (id: string) => void;
  setLicenseStatus: (status: EmployeeProfile["licenseStatus"]) => void;
  deleteLicenseAttachmentFromDB: (attachmentId: string) => Promise<void>;

  // Mockup Data Helper — รองรับ 3 รูปแบบ
  setMockupData: (preset: 1 | 2 | 3) => void;

  // API actions — ดึงและบันทึกข้อมูลกับ Backend
  isLoading: boolean;
  isSaving: boolean;
  fetchProfile: (userId: string, email?: string) => Promise<void>;
  // ✨ refresh เฉพาะ profileStrength — ไม่ overwrite profile ทั้งหมด
  refreshStrength: (userId: string, email?: string) => Promise<void>;
  saveProfile: (userId: string) => Promise<void>;
}

// ✨ ตรวจว่า string เป็น UUID จริงหรือไม่ (ป้องกัน Zod reject id ชั่วคราว เช่น "resume-xxx", "lic-xxx")
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuidOrUndefined = (id?: string): string | undefined =>
  id && UUID_REGEX.test(id) ? id : undefined;

const initialProfile: Partial<EmployeeProfile> = {
  firstName: "",
  lastName: "",
  phoneNumber: "",
  gender: "",
  dateOfBirth: "",
  nationality: "",
  profileImageUrl: "",
  educationLevel: "",
  institution: "",
  major: "",
  gpa: "",
  teachingLicense: "",
  licenseFileUrl: "",
  licenseStatus: "",
  licenseAttachments: [],
  specialization: [],
  gradeCanTeach: [],
  teachingExperience: "",
  recentSchool: "",
  languagesSpoken: [],
  itSkills: [],
  specialActivities: "",
  preferredProvinces: [],
  canRelocate: false,
  profileVisibility: "public",
  resumes: [],
  activeResumeId: null,
  workExperiences: [],
  educations: [],
  licenses: [],
  languages: [],
  skills: [],
};

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: initialProfile,
  isLoading: false,
  isSaving: false,

  setProfile: (profile) =>
    set((state) => ({
      profile: { ...state.profile, ...profile },
    })),

  updateField: (field, value) =>
    set((state) => ({
      profile: { ...state.profile, [field]: value },
    })),

  resetProfile: () => set({ profile: initialProfile }),

  // Work Experience methods
  addWorkExperience: (experience) =>
    set((state) => ({
      profile: {
        ...state.profile,
        workExperiences: [...(state.profile.workExperiences || []), experience],
      },
    })),

  updateWorkExperience: (index, experience) =>
    set((state) => ({
      profile: {
        ...state.profile,
        workExperiences: state.profile.workExperiences?.map((exp, i) =>
          i === index ? experience : exp,
        ),
      },
    })),

  removeWorkExperience: (index) =>
    set((state) => ({
      profile: {
        ...state.profile,
        workExperiences: state.profile.workExperiences?.filter(
          (_, i) => i !== index,
        ),
      },
    })),

  // Education methods
  addEducation: (education) =>
    set((state) => ({
      profile: {
        ...state.profile,
        educations: [...(state.profile.educations || []), education],
      },
    })),

  updateEducation: (index, education) =>
    set((state) => ({
      profile: {
        ...state.profile,
        educations: state.profile.educations?.map((edu, i) =>
          i === index ? education : edu,
        ),
      },
    })),

  removeEducation: (index) =>
    set((state) => ({
      profile: {
        ...state.profile,
        educations: state.profile.educations?.filter((_, i) => i !== index),
      },
    })),

  // License methods
  addLicense: (license) =>
    set((state) => ({
      profile: {
        ...state.profile,
        licenses: [...(state.profile.licenses || []), license],
      },
    })),

  updateLicense: (index, license) =>
    set((state) => ({
      profile: {
        ...state.profile,
        licenses: state.profile.licenses?.map((lic, i) =>
          i === index ? license : lic,
        ),
      },
    })),

  removeLicense: (index) =>
    set((state) => ({
      profile: {
        ...state.profile,
        licenses: state.profile.licenses?.filter((_, i) => i !== index),
      },
    })),

  // Language methods
  addLanguage: (language) =>
    set((state) => ({
      profile: {
        ...state.profile,
        languages: [...(state.profile.languages || []), language],
      },
    })),

  updateLanguage: (index, language) =>
    set((state) => ({
      profile: {
        ...state.profile,
        languages: state.profile.languages?.map((lang, i) =>
          i === index ? language : lang,
        ),
      },
    })),

  removeLanguage: (index) =>
    set((state) => ({
      profile: {
        ...state.profile,
        languages: state.profile.languages?.filter((_, i) => i !== index),
      },
    })),

  // Skill methods
  addSkill: (skill) =>
    set((state) => ({
      profile: {
        ...state.profile,
        skills: [...(state.profile.skills || []), skill],
      },
    })),

  updateSkill: (index, skill) =>
    set((state) => ({
      profile: {
        ...state.profile,
        skills: state.profile.skills?.map((s, i) => (i === index ? skill : s)),
      },
    })),

  removeSkill: (index) =>
    set((state) => ({
      profile: {
        ...state.profile,
        skills: state.profile.skills?.filter((_, i) => i !== index),
      },
    })),

  // เพิ่มเรซูเม่ใหม่เข้า list
  addResume: (resume) =>
    set((state) => ({
      profile: {
        ...state.profile,
        resumes: [...(state.profile.resumes ?? []), resume],
        // ถ้ายังไม่มี active ให้ตั้งไฟล์แรกเป็น active อัตโนมัติ
        activeResumeId: state.profile.activeResumeId ?? resume.id,
      },
    })),

  // ลบเรซูเม่ออกจาก list และ reset active ถ้าลบตัวที่ active อยู่
  removeResume: (id) =>
    set((state) => {
      const remaining = (state.profile.resumes ?? []).filter(
        (r) => r.id !== id,
      );
      const newActiveId =
        state.profile.activeResumeId === id
          ? (remaining[0]?.id ?? null)
          : state.profile.activeResumeId;
      return {
        profile: {
          ...state.profile,
          resumes: remaining,
          activeResumeId: newActiveId,
        },
      };
    }),

  // ตั้งเรซูเม่ที่กำลังใช้งาน
  setActiveResume: (id) =>
    set((state) => ({
      profile: { ...state.profile, activeResumeId: id },
    })),

  // ✨ ลบ resume ออกจาก store (ใช้ deleteResume API จาก _api/ แทน)
  deleteResumeFromDB: async (resumeId: string) => {
    set((state) => {
      const remaining = (state.profile.resumes ?? []).filter(
        (r) => r.id !== resumeId,
      );
      const newActiveId =
        state.profile.activeResumeId === resumeId
          ? (remaining[0]?.id ?? null)
          : state.profile.activeResumeId;
      return {
        profile: {
          ...state.profile,
          resumes: remaining,
          activeResumeId: newActiveId,
        },
      };
    });
  },

  // เพิ่มไฟล์แนบใบประกอบวิชาชีพ
  addLicenseAttachment: (file) =>
    set((state) => ({
      profile: {
        ...state.profile,
        licenseAttachments: [...(state.profile.licenseAttachments ?? []), file],
      },
    })),

  // ลบไฟล์แนบใบประกอบวิชาชีพ
  removeLicenseAttachment: (id) =>
    set((state) => ({
      profile: {
        ...state.profile,
        licenseAttachments: (state.profile.licenseAttachments ?? []).filter(
          (f) => f.id !== id,
        ),
      },
    })),

  // อัพเดตสถานะใบประกอบวิชาชีพ
  setLicenseStatus: (status) =>
    set((state) => ({
      profile: { ...state.profile, licenseStatus: status },
    })),

  // ✨ ลบไฟล์แนบใบประกอบฯ ออกจาก store (ใช้ deleteLicense API จาก _api/ แทน)
  deleteLicenseAttachmentFromDB: async (attachmentId: string) => {
    set((state) => ({
      profile: {
        ...state.profile,
        licenseAttachments: (state.profile.licenseAttachments ?? []).filter(
          (f) => f.id !== attachmentId,
        ),
      },
    }));
  },

  // Mockup Data Implementation — 3 รูปแบบ: ครูภาษา / ครูวิทย์-คณิต / ครูปฐมวัย
  setMockupData: (preset) =>
    set(() => {
      // ─── รูปแบบที่ 1: ครูภาษาอังกฤษ ประสบการณ์สูง มีใบประกอบฯ ───
      const preset1: Partial<EmployeeProfile> = {
        firstName: "ธนวัฒน์",
        lastName: "เรียนรู้ดี",
        phoneNumber: "081-234-5678",
        gender: "ชาย",
        dateOfBirth: "1995-05-15",
        nationality: "ไทย",
        profileImageUrl:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=thanawat",
        email: "thanawat.learn@example.com",
        specialActivities:
          "ครูผู้เชี่ยวชาญด้านการสอนภาษาอังกฤษและเทคโนโลยีการศึกษา มีความมุ่งมั่นในการพัฒนาทักษะการเรียนรู้ผ่านนวัตกรรม Active Learning ชอบกิจกรรมจิตอาสาและแนะแนวการศึกษา",
        licenseStatus: "has_license",
        licenseAttachments: [
          {
            id: "lic-mock-1",
            fileName: "ใบประกอบวิชาชีพ_ธนวัฒน์.pdf",
            fileSize: 1024 * 450,
            uploadedAt: "01/03/2567",
          },
        ],
        resumes: [
          {
            id: "res-mock-1",
            fileName: "Resume_Thanawat_2567.pdf",
            fileSize: 1024 * 820,
            uploadedAt: "15/03/2567",
          },
          {
            id: "res-mock-2",
            fileName: "Resume_Thanawat_Short.pdf",
            fileSize: 1024 * 310,
            uploadedAt: "20/03/2567",
          },
        ],
        activeResumeId: "res-mock-1",
        workExperiences: [
          {
            jobTitle: "ครูสอนภาษาอังกฤษ",
            companyName: "โรงเรียนนานาชาติเซนต์แมรี่",
            startDate: "2022-05-01",
            endDate: "",
            inPresent: true,
            description:
              "สอนภาษาอังกฤษระดับ G10–12 เน้นทักษะการสื่อสาร จัดกิจกรรม English Camp ประจำปี",
          },
          {
            jobTitle: "วิทยากรพิเศษ",
            companyName: "สถาบันกวดวิชาเอกวิทย์",
            startDate: "2020-06-01",
            endDate: "2022-04-30",
            inPresent: false,
            description:
              "ผลิตสื่อวิดีโอเตรียมสอบ TCAS มีนักเรียนติดตามกว่า 500 คนต่อเทอม",
          },
          {
            jobTitle: "ครูอัตราจ้าง",
            companyName: "โรงเรียนสาธิตพุทธมณฑล",
            startDate: "2018-05-15",
            endDate: "2020-04-30",
            inPresent: false,
            description: "สอนภาษาอังกฤษมัธยมต้น ดูแลนักเรียนแลกเปลี่ยนต่างชาติ",
          },
        ],
        educations: [
          {
            level: "ปริญญาโท",
            institution: "มหาวิทยาลัยธรรมศาสตร์",
            major: "ศิลปศาสตรมหาบัณฑิต (การสอนภาษาอังกฤษ)",
            graduationYear: 2565,
            gpa: 3.85,
          },
          {
            level: "ปริญญาตรี",
            institution: "จุฬาลงกรณ์มหาวิทยาลัย",
            major: "ครุศาสตรบัณฑิต (ภาษาอังกฤษ-ภาษาไทย)",
            graduationYear: 2562,
            gpa: 3.75,
          },
        ],
        specialization: [
          "การสอนภาษาอังกฤษ (ESL/EFL)",
          "การออกแบบบทเรียนออนไลน์",
          "เทคโนโลยีเพื่อการศึกษา (EdTech)",
        ],
        gradeCanTeach: ["มัธยมศึกษาตอนต้น", "มัธยมศึกษาตอนปลาย"],
        teachingExperience: "5-10 ปี",
        languagesSpoken: ["ไทย (Native)", "อังกฤษ (Fluent)", "เยอรมัน (Basic)"],
        itSkills: [
          "Microsoft Office",
          "Google Classroom",
          "Canva for Education",
          "Zoom / MS Teams",
        ],
        preferredProvinces: ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี"],
        canRelocate: true,
        profileVisibility: "public",
      };

      // ─── รูปแบบที่ 2: ครูคณิต-วิทย์ ประสบการณ์น้อย อยู่ระหว่างขอใบฯ ───
      const preset2: Partial<EmployeeProfile> = {
        firstName: "สุภาพร",
        lastName: "คิดเลขเก่ง",
        phoneNumber: "089-765-4321",
        gender: "หญิง",
        dateOfBirth: "2000-08-22",
        nationality: "ไทย",
        profileImageUrl:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=supaporn",
        email: "supaporn.math@example.com",
        specialActivities:
          "ครูรุ่นใหม่ที่หลงรักคณิตศาสตร์และวิทยาศาสตร์ มีความตั้งใจถ่ายทอดความรู้ให้นักเรียนเข้าใจง่ายผ่านสื่อ Visual และ Gamification",
        licenseStatus: "pending",
        licenseAttachments: [
          {
            id: "lic-mock-2",
            fileName: "คำขอใบประกอบวิชาชีพ_สุภาพร.pdf",
            fileSize: 1024 * 280,
            uploadedAt: "05/04/2567",
          },
        ],
        resumes: [
          {
            id: "res-mock-3",
            fileName: "Resume_Supaporn_2567.pdf",
            fileSize: 1024 * 640,
            uploadedAt: "10/04/2567",
          },
        ],
        activeResumeId: "res-mock-3",
        workExperiences: [
          {
            jobTitle: "ครูฝึกสอน",
            companyName: "โรงเรียนสาธิต ม.เกษตรศาสตร์",
            startDate: "2023-06-01",
            endDate: "2023-10-31",
            inPresent: false,
            description:
              "ฝึกสอนวิชาคณิตศาสตร์และวิทยาศาสตร์ระดับมัธยมต้น ออกแบบใบงานและสื่อการสอน",
          },
          {
            jobTitle: "ติวเตอร์คณิตศาสตร์",
            companyName: "ส่วนตัว (Freelance)",
            startDate: "2022-01-01",
            endDate: "",
            inPresent: true,
            description:
              "รับสอนพิเศษคณิตศาสตร์และฟิสิกส์สำหรับนักเรียน ม.4–ม.6 เน้นเตรียมสอบ TCAS",
          },
        ],
        educations: [
          {
            level: "ปริญญาตรี",
            institution: "มหาวิทยาลัยเกษตรศาสตร์",
            major: "ครุศาสตรบัณฑิต (คณิตศาสตร์)",
            graduationYear: 2566,
            gpa: 3.55,
          },
        ],
        specialization: ["คณิตศาสตร์", "วิทยาศาสตร์", "ฟิสิกส์"],
        gradeCanTeach: ["มัธยมศึกษาตอนต้น", "มัธยมศึกษาตอนปลาย"],
        teachingExperience: "น้อยกว่า 1 ปี",
        languagesSpoken: ["ไทย (Native)", "อังกฤษ (Intermediate)"],
        itSkills: ["Microsoft Office", "GeoGebra", "Desmos", "Kahoot"],
        preferredProvinces: ["กรุงเทพมหานคร", "สมุทรปราการ"],
        canRelocate: false,
        profileVisibility: "apply_only",
      };

      // ─── รูปแบบที่ 3: ครูปฐมวัย ประสบการณ์ปานกลาง ไม่มีใบประกอบฯ ───
      const preset3: Partial<EmployeeProfile> = {
        firstName: "มณีรัตน์",
        lastName: "รักเด็กดี",
        phoneNumber: "062-111-9999",
        gender: "หญิง",
        dateOfBirth: "1992-03-10",
        nationality: "ไทย",
        profileImageUrl:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=maneerat",
        email: "maneerat.kids@example.com",
        specialActivities:
          "ครูปฐมวัยที่มีใจรักเด็กและเชื่อในพลังของการเล่นเพื่อการเรียนรู้ มีประสบการณ์ดูแลเด็กอายุ 2–6 ปี เน้นพัฒนาการด้านอารมณ์ สังคม และทักษะชีวิต",
        licenseStatus: "not_required",
        licenseAttachments: [],
        resumes: [
          {
            id: "res-mock-4",
            fileName: "Resume_Maneerat_ปฐมวัย.pdf",
            fileSize: 1024 * 520,
            uploadedAt: "01/01/2567",
          },
          {
            id: "res-mock-5",
            fileName: "Portfolio_Maneerat.pdf",
            fileSize: 1024 * 1200,
            uploadedAt: "15/01/2567",
          },
        ],
        activeResumeId: "res-mock-4",
        workExperiences: [
          {
            jobTitle: "ครูประจำชั้นอนุบาล 2",
            companyName: "โรงเรียนอนุบาลสาธิตบ้านหรรษา",
            startDate: "2020-05-01",
            endDate: "",
            inPresent: true,
            description:
              "ดูแลนักเรียนอนุบาล จัดกิจกรรม Play-based Learning ทำงานร่วมกับผู้ปกครองอย่างสม่ำเสมอ",
          },
          {
            jobTitle: "พี่เลี้ยงเด็ก",
            companyName: "ศูนย์เด็กเล็ก เทศบาลนครนนทบุรี",
            startDate: "2017-06-01",
            endDate: "2020-04-30",
            inPresent: false,
            description:
              "ดูแลเด็กอายุ 2–4 ปี ส่งเสริมพัฒนาการด้านภาษาและกล้ามเนื้อมัดเล็ก",
          },
        ],
        educations: [
          {
            level: "ปริญญาตรี",
            institution: "มหาวิทยาลัยราชภัฏพระนคร",
            major: "ครุศาสตรบัณฑิต (การศึกษาปฐมวัย)",
            graduationYear: 2558,
            gpa: 3.2,
          },
        ],
        specialization: [
          "การศึกษาปฐมวัย",
          "Play-based Learning",
          "การพัฒนาทักษะชีวิตเด็ก",
        ],
        gradeCanTeach: ["อนุบาล"],
        teachingExperience: "3-5 ปี",
        languagesSpoken: ["ไทย (Native)"],
        itSkills: ["Microsoft Office", "Canva", "Line Official"],
        preferredProvinces: [
          "กรุงเทพมหานคร",
          "นนทบุรี",
          "ปทุมธานี",
          "สมุทรปราการ",
        ],
        canRelocate: false,
        profileVisibility: "public",
      };

      const presetMap = { 1: preset1, 2: preset2, 3: preset3 };
      return { profile: presetMap[preset] };
    }),

  // ✨ ดึงข้อมูลโปรไฟล์จาก API และ map ลง store
  // ส่ง email ไปด้วยเพื่อให้ API auto-create profile ถ้ายังไม่มีใน DB
  fetchProfile: async (userId: string, email?: string) => {
    set({ isLoading: true });
    try {
      const res = await responseEmployeeProfile(userId, email);
      if (res.status_code === 200 && res.data) {
        const d = res.data;
        // map DB field names → store field names
        set({
          profile: {
            id: d.id,
            userId: d.userId,
            email: d.email,
            firstName: d.firstName ?? "",
            lastName: d.lastName ?? "",
            phoneNumber: d.phoneNumber ?? "",
            gender: d.gender ?? "",
            // ✨ ใช้ UTC date string โดยตรงเพื่อป้องกัน timezone off-by-one
            dateOfBirth: d.dateOfBirth
              ? d.dateOfBirth.toString().split("T")[0]
              : "",
            nationality: d.nationality ?? "",
            profileImageUrl: d.profileImageUrl ?? "",
            profileVisibility: d.profileVisibility ?? "public",
            teachingExperience: d.teachingExperience ?? "",
            recentSchool: d.recentSchool ?? "",
            specialActivities: d.specialActivities ?? "",
            canRelocate: d.canRelocate ?? false,
            licenseStatus: d.licenseStatus ?? "",
            // Array relations
            specialization:
              d.specializations?.map((s: { subject: string }) => s.subject) ??
              [],
            gradeCanTeach:
              d.gradeCanTeaches?.map((g: { grade: string }) => g.grade) ?? [],
            preferredProvinces:
              d.preferredProvinces?.map(
                (p: { province: string }) => p.province,
              ) ?? [],
            workExperiences:
              d.workExperiences?.map(
                (exp: {
                  id: string;
                  jobTitle: string;
                  companyName: string;
                  startDate: string;
                  endDate: string | null;
                  inPresent: boolean;
                  description: string | null;
                  workYear: number | null;
                }) => ({
                  id: exp.id,
                  jobTitle: exp.jobTitle,
                  companyName: exp.companyName,
                  startDate: exp.startDate
                    ? new Date(exp.startDate).toISOString().split("T")[0]
                    : "",
                  endDate: exp.endDate
                    ? new Date(exp.endDate).toISOString().split("T")[0]
                    : "",
                  inPresent: exp.inPresent,
                  description: exp.description ?? "",
                  workYear: exp.workYear ?? undefined,
                }),
              ) ?? [],
            educations:
              d.educations?.map(
                (edu: {
                  id: string;
                  level: string;
                  institution: string;
                  major: string;
                  graduationYear: number | null;
                  gpa: number | null;
                  startDate: string | null;
                  endDate: string | null;
                }) => ({
                  id: edu.id,
                  level: edu.level,
                  institution: edu.institution,
                  major: edu.major,
                  graduationYear: edu.graduationYear ?? undefined,
                  gpa: edu.gpa ?? undefined,
                  startDate: edu.startDate
                    ? new Date(edu.startDate).toISOString().split("T")[0]
                    : undefined,
                  endDate: edu.endDate
                    ? new Date(edu.endDate).toISOString().split("T")[0]
                    : undefined,
                }),
              ) ?? [],
            // ✨ licenses ที่มี fileUrl → map กลับเป็น licenseAttachments ด้วย
            licenses: (d.licenses ?? [])
              .filter(
                (lic: { fileUrl: string | null | undefined }) =>
                  lic.fileUrl == null,
              ) // license record ที่ไม่มีไฟล์แนบ
              .map(
                (lic: {
                  id: string;
                  licenseName: string;
                  issuer: string | null;
                  licenseNumber: string | null;
                  issueDate: string | null;
                  expiryDate: string | null;
                  credentialUrl: string | null;
                }) => ({
                  id: lic.id,
                  licenseName: lic.licenseName,
                  issuer: lic.issuer ?? undefined,
                  licenseNumber: lic.licenseNumber ?? undefined,
                  issueDate: lic.issueDate
                    ? new Date(lic.issueDate).toISOString().split("T")[0]
                    : undefined,
                  expiryDate: lic.expiryDate
                    ? new Date(lic.expiryDate).toISOString().split("T")[0]
                    : undefined,
                  credentialUrl: lic.credentialUrl ?? undefined,
                }),
              ),
            // ✨ licenses ที่มี fileUrl → map เป็น licenseAttachments (ไฟล์แนบใบประกอบฯ)
            licenseAttachments: (d.licenses ?? [])
              .filter(
                (lic: { fileUrl: string | null | undefined }) =>
                  lic.fileUrl != null && lic.fileUrl !== "",
              )
              .map(
                (lic: {
                  id: string;
                  licenseName: string;
                  fileSize?: number | null;
                  fileUrl: string;
                  uploadedAt?: string;
                  createdAt?: string;
                }) => ({
                  id: lic.id,
                  fileName: lic.licenseName,
                  fileSize: lic.fileSize ?? 0,
                  uploadedAt: lic.createdAt
                    ? new Date(lic.createdAt).toLocaleDateString("th-TH")
                    : "",
                  url: lic.fileUrl,
                }),
              ),
            languages:
              d.languages?.map(
                (lang: {
                  id: string;
                  languageName: string;
                  proficiency: string | null;
                }) => ({
                  id: lang.id,
                  languageName: lang.languageName,
                  proficiency: lang.proficiency ?? undefined,
                }),
              ) ?? [],
            // ✨ map เป็น string array สำหรับ UI display และ form
            languagesSpoken:
              d.languages?.map((lang: { languageName: string }) => lang.languageName) ?? [],
            skills:
              d.skills?.map((sk: { id: string; skillName: string }) => ({
                id: sk.id,
                skillName: sk.skillName,
              })) ?? [],
            itSkills:
              d.skills?.map((sk: { skillName: string }) => sk.skillName) ?? [],
            // ✨ resumes จาก DB → map กลับใส่ store พร้อม url
            resumes: (d.resumes ?? []).map(
              (r: {
                id: string;
                fileName: string;
                fileSize: number | null;
                uploadedAt: string;
                fileUrl: string;
              }) => ({
                id: r.id,
                fileName: r.fileName,
                fileSize: r.fileSize ?? 0,
                uploadedAt: new Date(r.uploadedAt).toLocaleDateString("th-TH"),
                url: r.fileUrl,
              }),
            ),
            // ✨ activeResumeId — ดึงจาก resume ที่ isActive = true
            activeResumeId:
              d.resumes?.find((r: { isActive: boolean }) => r.isActive)?.id ??
              d.activeResumeId ??
              null,
            // ✨ profileStrength — คำนวณโดย API service แล้ว
            profileStrength: d.profileStrength ?? undefined,
          },
        });
      }
    } catch (err) {
      console.error("❌ fetchProfile error:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ✨ บันทึกโปรไฟล์ปัจจุบันใน store ไปยัง API
  refreshStrength: async (userId: string, email?: string) => {
    // ✨ เรียก API เดิมแต่ update เฉพาะ profileStrength — ไม่ set profile ทั้งหมด
    try {
      const res = await responseEmployeeProfile(userId, email);
      if (res.status_code === 200 && res.data?.profileStrength) {
        set((state) => ({
          profile: {
            ...state.profile,
            profileStrength: res.data.profileStrength,
          },
        }));
      }
    } catch (err) {
      console.error("❌ refreshStrength error:", err);
    }
  },

  saveProfile: async (userId: string) => {
    set({ isSaving: true });
    try {
      const p = get().profile;
      const payload: Record<string, unknown> = {
        first_name: p.firstName || undefined,
        last_name: p.lastName || undefined,
        phone_number: p.phoneNumber,
        gender: p.gender,
        date_of_birth: p.dateOfBirth || null,
        nationality: p.nationality,
        profile_image_url: p.profileImageUrl || null,
        profile_visibility: p.profileVisibility,
        teaching_experience: p.teachingExperience,
        recent_school: p.recentSchool,
        special_activities: p.specialActivities,
        can_relocate: p.canRelocate,
        license_status: p.licenseStatus || null,
        active_resume_id:
          toUuidOrUndefined(p.activeResumeId ?? undefined) ?? null,
        // Array relations
        specializations: p.specialization ?? [],
        grade_can_teaches: p.gradeCanTeach ?? [],
        preferred_provinces: p.preferredProvinces ?? [],
        // Sub-relations — ส่งเฉพาะที่มี (ไม่ส่ง field ที่ไม่เกี่ยวกับ DB)
        work_experiences: (p.workExperiences ?? []).map((exp) => ({
          id: toUuidOrUndefined(exp.id),
          job_title: exp.jobTitle,
          company_name: exp.companyName,
          start_date: exp.startDate,
          end_date: exp.endDate || null,
          in_present: exp.inPresent,
          description: exp.description || null,
          work_year: exp.workYear ?? null,
          is_deleted: exp.isDeleted ?? false,
        })),
        educations: (p.educations ?? []).map((edu) => ({
          id: toUuidOrUndefined(edu.id),
          level: edu.level,
          institution: edu.institution,
          major: edu.major,
          graduation_year: edu.graduationYear ?? null,
          gpa: edu.gpa ?? null,
          start_date: edu.startDate || null,
          end_date: edu.endDate || null,
          is_deleted: edu.isDeleted ?? false,
        })),
        // ✨ licenses = LicenseEntry + licenseAttachments (ไฟล์แนบที่ upload แล้ว)
        licenses: [
          ...(p.licenses ?? []).map((lic) => ({
            id: toUuidOrUndefined(lic.id),
            license_name: lic.licenseName,
            issuer: lic.issuer ?? null,
            license_number: lic.licenseNumber ?? null,
            issue_date: lic.issueDate ?? null,
            expiry_date: lic.expiryDate ?? null,
            file_url: null,
            credential_url: lic.credentialUrl ?? null,
            is_deleted: lic.isDeleted ?? false,
          })),
          ...(p.licenseAttachments ?? [])
            .filter((att) => att.url)
            .map((att) => ({
              id: toUuidOrUndefined(att.id),
              license_name: att.fileName,
              issuer: null,
              license_number: null,
              issue_date: null,
              expiry_date: null,
              file_url: att.url!,
              credential_url: null,
              is_deleted: false,
            })),
        ],
        // ✨ ส่ง resumes ที่มี url (อัปโหลดสำเร็จแล้ว) ไปบันทึกลง DB
        resumes: (p.resumes ?? [])
          .filter((r) => r.url)
          .map((r) => ({
            id: toUuidOrUndefined(r.id),
            file_name: r.fileName,
            file_size: r.fileSize ?? null,
            file_url: r.url!,
            is_active: r.id === p.activeResumeId,
            is_deleted: false,
          })),
        languages: (p.languages ?? []).map((lang) => ({
          id: toUuidOrUndefined(lang.id),
          language_name: lang.languageName,
          proficiency: lang.proficiency ?? null,
          is_deleted: lang.isDeleted ?? false,
        })),
        skills: (p.skills ?? []).map((sk) => ({
          id: toUuidOrUndefined(sk.id),
          skill_name: sk.skillName,
          is_deleted: sk.isDeleted ?? false,
        })),
      };

      await requestUpdateEmployeeProfile(userId, payload);

      // ✨ silent re-fetch เพื่อ sync UUID จริงจาก DB กลับมา store
      // ป้องกัน temp id ค้างใน store ซึ่งจะทำให้ save ครั้งถัดไป create record ซ้ำ
      const email = get().profile.email;
      const res = await responseEmployeeProfile(userId, email);
      if (res.status_code === 200 && res.data) {
        const d = res.data;
        set((state) => ({
          profile: {
            ...state.profile,
            profileStrength: d.profileStrength ?? state.profile.profileStrength,
            workExperiences:
              d.workExperiences?.map(
                (exp: {
                  id: string;
                  jobTitle: string;
                  companyName: string;
                  startDate: string;
                  endDate: string | null;
                  inPresent: boolean;
                  description: string | null;
                  workYear: number | null;
                }) => ({
                  id: exp.id,
                  jobTitle: exp.jobTitle,
                  companyName: exp.companyName,
                  startDate: exp.startDate
                    ? new Date(exp.startDate).toISOString().split("T")[0]
                    : "",
                  endDate: exp.endDate
                    ? new Date(exp.endDate).toISOString().split("T")[0]
                    : "",
                  inPresent: exp.inPresent,
                  description: exp.description ?? "",
                  workYear: exp.workYear ?? undefined,
                }),
              ) ?? state.profile.workExperiences,
            educations:
              d.educations?.map(
                (edu: {
                  id: string;
                  level: string;
                  institution: string;
                  major: string;
                  graduationYear: number | null;
                  gpa: number | null;
                  startDate: string | null;
                  endDate: string | null;
                }) => ({
                  id: edu.id,
                  level: edu.level,
                  institution: edu.institution,
                  major: edu.major,
                  graduationYear: edu.graduationYear ?? undefined,
                  gpa: edu.gpa ?? undefined,
                  startDate: edu.startDate
                    ? new Date(edu.startDate).toISOString().split("T")[0]
                    : undefined,
                  endDate: edu.endDate
                    ? new Date(edu.endDate).toISOString().split("T")[0]
                    : undefined,
                }),
              ) ?? state.profile.educations,
            licenses: (d.licenses ?? [])
              .filter((lic: { fileUrl: string | null }) => !lic.fileUrl)
              .map(
                (lic: {
                  id: string;
                  licenseName: string;
                  issuer: string | null;
                  licenseNumber: string | null;
                  issueDate: string | null;
                  expiryDate: string | null;
                  credentialUrl: string | null;
                }) => ({
                  id: lic.id,
                  licenseName: lic.licenseName,
                  issuer: lic.issuer ?? undefined,
                  licenseNumber: lic.licenseNumber ?? undefined,
                  issueDate: lic.issueDate
                    ? new Date(lic.issueDate).toISOString().split("T")[0]
                    : undefined,
                  expiryDate: lic.expiryDate
                    ? new Date(lic.expiryDate).toISOString().split("T")[0]
                    : undefined,
                  credentialUrl: lic.credentialUrl ?? undefined,
                }),
              ),
            licenseAttachments: (d.licenses ?? [])
              .filter((lic: { fileUrl: string | null }) => !!lic.fileUrl)
              .map(
                (lic: {
                  id: string;
                  licenseName: string;
                  fileSize?: number | null;
                  fileUrl: string;
                  createdAt?: string;
                }) => ({
                  id: lic.id,
                  fileName: lic.licenseName,
                  fileSize: lic.fileSize ?? 0,
                  uploadedAt: lic.createdAt
                    ? new Date(lic.createdAt).toLocaleDateString("th-TH")
                    : "",
                  url: lic.fileUrl,
                }),
              ),
            languagesSpoken:
              d.languages?.map((lang: { languageName: string }) => lang.languageName) ??
              state.profile.languagesSpoken,
            itSkills:
              d.skills?.map((sk: { skillName: string }) => sk.skillName) ??
              state.profile.itSkills,
            resumes: (d.resumes ?? []).map(
              (r: {
                id: string;
                fileName: string;
                fileSize: number | null;
                uploadedAt: string;
                fileUrl: string;
              }) => ({
                id: r.id,
                fileName: r.fileName,
                fileSize: r.fileSize ?? 0,
                uploadedAt: new Date(r.uploadedAt).toLocaleDateString("th-TH"),
                url: r.fileUrl,
              }),
            ),
            activeResumeId:
              d.resumes?.find((r: { isActive: boolean }) => r.isActive)?.id ??
              d.activeResumeId ??
              state.profile.activeResumeId,
          },
        }));
      }
    } catch (err) {
      console.error("❌ saveProfile error:", err);
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },
}));
