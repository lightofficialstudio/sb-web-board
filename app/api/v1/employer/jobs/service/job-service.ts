import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { CreateJobInput, UpdateJobInput } from "../validation/job-schema";

// ✨ ค้นหา SchoolProfile จาก userId เพื่อเอา schoolProfileId
const getSchoolProfileId = async (userId: string): Promise<string> => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolProfile: { select: { id: true } } },
  });
  if (!profile?.schoolProfile) {
    throw new Error("SCHOOL_PROFILE_NOT_FOUND");
  }
  return profile.schoolProfile.id;
};

// ✨ resolveSchoolProfileId — รองรับ Delegated Context
// ถ้า delegatedSchoolProfileId ระบุมา ให้ตรวจสอบ permission ก่อน แล้วใช้ค่านั้นแทน
export const resolveSchoolProfileId = async (
  userId: string,
  requiredPermission: string,
  delegatedSchoolProfileId?: string | null,
): Promise<string> => {
  if (!delegatedSchoolProfileId) {
    // ✨ ใช้ schoolProfile ของตัวเอง (ปกติ)
    return getSchoolProfileId(userId);
  }

  // ✨ Delegated mode — ตรวจสอบว่า userId มี permission สำหรับโรงเรียนนั้นจริง
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const member = await prisma.orgMember.findFirst({
    where: {
      profileId: profile.id,
      orgId: delegatedSchoolProfileId, // orgId = schoolProfileId ในระบบนี้
      status: "ACTIVE",
      role: {
        permissions: {
          some: { permissionKey: requiredPermission },
        },
      },
    },
    select: { id: true },
  });

  if (!member) throw new Error("DELEGATED_PERMISSION_DENIED");

  return delegatedSchoolProfileId;
};

// ✨ ดึงข้อมูลประกาศงานทั้งหมดของโรงเรียน โดยใช้ userId (รวม application count)
export const getJobsByUserService = async (
  userId: string,
  delegatedSchoolProfileId?: string | null,
) => {
  const schoolProfileId = await resolveSchoolProfileId(
    userId,
    "jobs:read",
    delegatedSchoolProfileId,
  );
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return await prisma.job.findMany({
    where: { schoolProfileId },
    include: {
      jobSubjects: true,
      jobGrades: true,
      jobBenefits: true,
      _count: {
        select: { applications: true, jobViews: true },
      },
      applications: {
        where: { appliedAt: { gte: sevenDaysAgo } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ✨ ดึงข้อมูลประกาศงานตาม ID (ตรวจสอบ ownership ด้วย userId)
export const getJobByIdService = async (userId: string, jobId: string) => {
  const schoolProfileId = await getSchoolProfileId(userId);
  return await prisma.job.findFirst({
    where: { id: jobId, schoolProfileId },
    include: {
      jobSubjects: true,
      jobGrades: true,
      jobBenefits: true,
    },
  });
};

// ✨ สร้างประกาศงานใหม่พร้อม subjects, grades, benefits ใน Transaction เดียว
export const createJobService = async (
  userId: string,
  payload: CreateJobInput,
  delegatedSchoolProfileId?: string | null,
) => {
  const schoolProfileId = await resolveSchoolProfileId(
    userId,
    "jobs:create",
    delegatedSchoolProfileId,
  );

  return await prisma.$transaction(async (tx) => {
    // คำนวณ deadline จาก deadline_days
    const deadline = payload.deadline_days
      ? new Date(Date.now() + payload.deadline_days * 24 * 60 * 60 * 1000)
      : null;

    const job = await tx.job.create({
      data: {
        schoolProfileId,
        title: payload.title,
        jobType: payload.employment_type ?? null,
        positionsAvailable: payload.vacancy_count ?? 1,
        salaryMin: payload.salary_min ?? null,
        salaryMax: payload.salary_max ?? null,
        salaryNegotiable: payload.salary_negotiable ?? false,
        description: payload.description ?? null,
        educationLevel: payload.education_level ?? null,
        experience: payload.experience ?? null,
        qualifications: payload.qualifications ?? null,
        gender: payload.gender ?? null,
        province: payload.province,
        district: payload.area ?? null,
        deadline,
        status: payload.is_published ? JobStatus.OPEN : JobStatus.DRAFT,
        // licenseRequired จาก license field
        licenseRequired:
          payload.license === "จำเป็นต้องมี"
            ? "required"
            : payload.license === "ไม่จำเป็น"
              ? "not_required"
              : "not_required",
      },
    });

    // ✨ สร้าง subjects
    if (payload.subjects && payload.subjects.length > 0) {
      await tx.jobSubject.createMany({
        data: payload.subjects.map((subject) => ({ jobId: job.id, subject })),
      });
    }

    // ✨ สร้าง grades
    if (payload.grades && payload.grades.length > 0) {
      await tx.jobGrade.createMany({
        data: payload.grades.map((grade) => ({ jobId: job.id, grade })),
      });
    }

    // ✨ สร้าง benefits
    if (payload.benefits && payload.benefits.length > 0) {
      await tx.jobBenefit.createMany({
        data: payload.benefits.map((benefit) => ({ jobId: job.id, benefit })),
      });
    }

    return await tx.job.findUnique({
      where: { id: job.id },
      include: { jobSubjects: true, jobGrades: true, jobBenefits: true },
    });
  });
};

// ✨ อัปเดตประกาศงาน (replace strategy สำหรับ subjects/grades/benefits)
export const updateJobService = async (
  userId: string,
  jobId: string,
  payload: UpdateJobInput,
) => {
  const schoolProfileId = await getSchoolProfileId(userId);

  // ตรวจสอบว่า job เป็นของโรงเรียนนี้
  const existing = await prisma.job.findFirst({
    where: { id: jobId, schoolProfileId },
  });
  if (!existing) throw new Error("JOB_NOT_FOUND");

  return await prisma.$transaction(async (tx) => {
    const deadline =
      payload.deadline_days !== undefined
        ? payload.deadline_days
          ? new Date(Date.now() + payload.deadline_days * 24 * 60 * 60 * 1000)
          : null
        : existing.deadline;

    await tx.job.update({
      where: { id: jobId },
      data: {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.employment_type !== undefined && {
          jobType: payload.employment_type ?? null,
        }),
        ...(payload.vacancy_count !== undefined && {
          positionsAvailable: payload.vacancy_count,
        }),
        ...(payload.salary_min !== undefined && {
          salaryMin: payload.salary_min ?? null,
        }),
        ...(payload.salary_max !== undefined && {
          salaryMax: payload.salary_max ?? null,
        }),
        ...(payload.salary_negotiable !== undefined && {
          salaryNegotiable: payload.salary_negotiable,
        }),
        ...(payload.description !== undefined && {
          description: payload.description ?? null,
        }),
        ...(payload.education_level !== undefined && {
          educationLevel: payload.education_level ?? null,
        }),
        ...(payload.experience !== undefined && {
          experience: payload.experience ?? null,
        }),
        ...(payload.qualifications !== undefined && {
          qualifications: payload.qualifications ?? null,
        }),
        ...(payload.gender !== undefined && {
          gender: payload.gender ?? null,
        }),
        ...(payload.province !== undefined && { province: payload.province }),
        ...(payload.area !== undefined && { district: payload.area ?? null }),
        ...(payload.is_published !== undefined && {
          status: payload.is_published ? JobStatus.OPEN : JobStatus.DRAFT,
        }),
        ...(payload.license !== undefined && {
          licenseRequired:
            payload.license === "จำเป็นต้องมี" ? "required" : "not_required",
        }),
        deadline,
      },
    });

    // ✨ Replace subjects
    if (payload.subjects !== undefined) {
      await tx.jobSubject.deleteMany({ where: { jobId } });
      if (payload.subjects.length > 0) {
        await tx.jobSubject.createMany({
          data: payload.subjects.map((subject) => ({ jobId, subject })),
        });
      }
    }

    // ✨ Replace grades
    if (payload.grades !== undefined) {
      await tx.jobGrade.deleteMany({ where: { jobId } });
      if (payload.grades.length > 0) {
        await tx.jobGrade.createMany({
          data: payload.grades.map((grade) => ({ jobId, grade })),
        });
      }
    }

    // ✨ Replace benefits
    if (payload.benefits !== undefined) {
      await tx.jobBenefit.deleteMany({ where: { jobId } });
      if (payload.benefits.length > 0) {
        await tx.jobBenefit.createMany({
          data: payload.benefits.map((benefit) => ({ jobId, benefit })),
        });
      }
    }

    return await tx.job.findUnique({
      where: { id: jobId },
      include: { jobSubjects: true, jobGrades: true, jobBenefits: true },
    });
  });
};

// ✨ ปิดรับสมัครประกาศงาน (เปลี่ยน status เป็น CLOSED)
export const closeJobService = async (userId: string, jobId: string) => {
  const schoolProfileId = await getSchoolProfileId(userId);
  const existing = await prisma.job.findFirst({
    where: { id: jobId, schoolProfileId },
  });
  if (!existing) throw new Error("JOB_NOT_FOUND");

  return await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.CLOSED },
  });
};

// ─── Pipeline Summary ────────────────────────────────────────────────────────

export interface UrgentJobItem {
  jobId: string;
  title: string;
  type: "new_applicants" | "expiring_soon" | "pending_interview";
  count: number; // จำนวนผู้สมัครใหม่ หรือวันที่เหลือ
}

export interface PipelineSummary {
  totalApplicants: number;
  pending: number;
  interview: number;
  accepted: number;
  rejected: number;
  totalVacancies: number; // sum positionsAvailable ของงานที่ OPEN
  urgentJobs: UrgentJobItem[];
}

// ✨ สรุป Pipeline การรับสมัครทั้งหมดของโรงเรียน
export const getPipelineService = async (
  userId: string,
): Promise<PipelineSummary> => {
  const schoolProfileId = await getSchoolProfileId(userId);

  // ดึงงานทั้งหมดพร้อม applications + จำนวน
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const jobs = await prisma.job.findMany({
    where: { schoolProfileId },
    select: {
      id: true,
      title: true,
      status: true,
      deadline: true,
      positionsAvailable: true,
      applications: {
        select: { id: true, status: true, appliedAt: true },
      },
    },
  });

  // นับ applications แยก status
  let pending = 0;
  let interview = 0;
  let accepted = 0;
  let rejected = 0;
  let totalVacancies = 0;
  const urgentJobs: UrgentJobItem[] = [];

  for (const job of jobs) {
    const apps = job.applications;

    // นับ status
    for (const app of apps) {
      if (app.status === "PENDING") pending++;
      else if (app.status === "INTERVIEW") interview++;
      else if (app.status === "ACCEPTED") accepted++;
      else if (app.status === "REJECTED") rejected++;
    }

    // นับ vacancy เฉพาะงาน OPEN
    if (job.status === JobStatus.OPEN) {
      totalVacancies += job.positionsAvailable;
    }

    // ตรวจหา urgent items
    const newApplicantsCount = apps.filter(
      (a) => a.appliedAt >= threeDaysAgo,
    ).length;
    if (newApplicantsCount > 0) {
      urgentJobs.push({
        jobId: job.id,
        title: job.title,
        type: "new_applicants",
        count: newApplicantsCount,
      });
    }

    // งานใกล้หมดอายุ (OPEN + deadline ภายใน 7 วัน)
    if (
      job.status === JobStatus.OPEN &&
      job.deadline &&
      job.deadline <= sevenDaysFromNow
    ) {
      const daysLeft = Math.ceil(
        (job.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      urgentJobs.push({
        jobId: job.id,
        title: job.title,
        type: "expiring_soon",
        count: Math.max(daysLeft, 0),
      });
    }

    // ผู้สมัครที่รอนัดสัมภาษณ์
    const pendingInterviewCount = apps.filter(
      (a) => a.status === "INTERVIEW",
    ).length;
    if (pendingInterviewCount > 0) {
      urgentJobs.push({
        jobId: job.id,
        title: job.title,
        type: "pending_interview",
        count: pendingInterviewCount,
      });
    }
  }

  return {
    totalApplicants: pending + interview + accepted + rejected,
    pending,
    interview,
    accepted,
    rejected,
    totalVacancies,
    urgentJobs,
  };
};

// ─── Applicants ────────────────────────────────────────────────────────────────

// ✨ ดึงรายชื่อผู้สมัครของตำแหน่งงาน พร้อม profile ครบถ้วน
export const getApplicantsByJobService = async (userId: string, jobId: string) => {
  const schoolProfileId = await getSchoolProfileId(userId);

  // ตรวจสอบว่า job เป็นของโรงเรียนนี้
  const job = await prisma.job.findFirst({
    where: { id: jobId, schoolProfileId },
    select: { id: true },
  });
  if (!job) throw new Error("JOB_NOT_FOUND");

  return await prisma.application.findMany({
    where: { jobId },
    orderBy: { appliedAt: "desc" },
    include: {
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          teachingExperience: true,
          specialActivities: true,
          profileImageUrl: true,
          specializations: { select: { subject: true } },
          gradeCanTeaches: { select: { grade: true } },
          languages: {
            where: { isDeleted: false },
            select: { languageName: true, proficiency: true },
          },
          skills: {
            where: { isDeleted: false },
            select: { skillName: true },
          },
          workExperiences: {
            where: { isDeleted: false },
            orderBy: { startDate: "desc" },
            select: {
              jobTitle: true,
              companyName: true,
              startDate: true,
              endDate: true,
              inPresent: true,
              description: true,
            },
          },
          educations: {
            where: { isDeleted: false },
            orderBy: { graduationYear: "desc" },
            select: {
              level: true,
              institution: true,
              major: true,
              graduationYear: true,
              gpa: true,
            },
          },
          preferredProvinces: { select: { province: true } },
        },
      },
      resume: { select: { fileName: true, fileUrl: true } },
    },
  });
};

// ✨ ดึงผู้สมัครใหม่ (PENDING ใน 7 วัน) ทุกตำแหน่งของโรงเรียน
export const getNewApplicantsService = async (userId: string) => {
  const schoolProfileId = await getSchoolProfileId(userId);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return await prisma.application.findMany({
    where: {
      status: "PENDING",
      appliedAt: { gte: sevenDaysAgo },
      job: { schoolProfileId },
    },
    orderBy: { appliedAt: "desc" },
    include: {
      job: { select: { id: true, title: true } },
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          teachingExperience: true,
          specialActivities: true,
          profileImageUrl: true,
          specializations: { select: { subject: true } },
          gradeCanTeaches: { select: { grade: true } },
          languages: {
            where: { isDeleted: false },
            select: { languageName: true, proficiency: true },
          },
          skills: {
            where: { isDeleted: false },
            select: { skillName: true },
          },
          workExperiences: {
            where: { isDeleted: false },
            orderBy: { startDate: "desc" },
            select: {
              jobTitle: true,
              companyName: true,
              startDate: true,
              endDate: true,
              inPresent: true,
              description: true,
            },
          },
          educations: {
            where: { isDeleted: false },
            orderBy: { graduationYear: "desc" },
            select: {
              level: true,
              institution: true,
              major: true,
              graduationYear: true,
              gpa: true,
            },
          },
          preferredProvinces: { select: { province: true } },
        },
      },
      resume: { select: { fileName: true, fileUrl: true } },
    },
  });
};

// ✨ อัปเดตสถานะผู้สมัคร (EMPLOYER เท่านั้น — ตรวจสอบ ownership ผ่าน jobId)
export const updateApplicantStatusService = async (
  userId: string,
  applicationId: string,
  status: "PENDING" | "INTERVIEW" | "ACCEPTED" | "REJECTED",
) => {
  const schoolProfileId = await getSchoolProfileId(userId);

  // ตรวจสอบว่า application อยู่ภายใต้โรงเรียนนี้
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: { schoolProfileId },
    },
    select: {
      id: true,
      applicantId: true,
      job: { select: { title: true, schoolProfile: { select: { schoolName: true } } } },
    },
  });
  if (!application) throw new Error("APPLICATION_NOT_FOUND");

  return await prisma.application.update({
    where: { id: applicationId },
    data: { status },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      applicantId: true,
      job: { select: { title: true, schoolProfile: { select: { schoolName: true } } } },
    },
  });
};

// ─── Job Stats ────────────────────────────────────────────────────────────────

export interface JobStatsResult {
  jobId: string;
  jobTitle: string;
  publishedAt: string;
  expiresAt: string;
  totalViews: number;
  totalApplicants: number;
  newApplicants: number;
  conversionRate: string;
  avgTimeToApply: string;
  pipeline: { label: string; count: number; color: string }[];
  dailyTrend: { date: string; views: number; applicants: number }[];
  sources: { label: string; count: number; percent: number }[];
  experienceLevels: { label: string; count: number; percent: number }[];
}

// ✨ ดึงสถิติเชิงลึกของตำแหน่งงาน — views, pipeline, daily trend, experience breakdown
export const getJobStatsService = async (
  userId: string,
  jobId: string,
): Promise<JobStatsResult> => {
  const schoolProfileId = await getSchoolProfileId(userId);

  // ตรวจสอบว่า job เป็นของโรงเรียนนี้
  const job = await prisma.job.findFirst({
    where: { id: jobId, schoolProfileId },
    select: { id: true, title: true, createdAt: true, deadline: true },
  });
  if (!job) throw new Error("JOB_NOT_FOUND");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ✨ ดึงข้อมูลพร้อมกัน (parallel queries)
  const [jobViews, applications] = await Promise.all([
    prisma.jobView.findMany({
      where: { jobId },
      select: { viewedAt: true },
      orderBy: { viewedAt: "asc" },
    }),
    prisma.application.findMany({
      where: { jobId },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        applicant: {
          select: { teachingExperience: true },
        },
      },
    }),
  ]);

  // ─── totalViews / totalApplicants / newApplicants ─────────────────────────
  const totalViews = jobViews.length;
  const totalApplicants = applications.length;
  const newApplicants = applications.filter(
    (a) => a.appliedAt >= sevenDaysAgo,
  ).length;

  const conversionRate =
    totalViews > 0
      ? `${((totalApplicants / totalViews) * 100).toFixed(1)}%`
      : "0%";

  // ─── Pipeline ─────────────────────────────────────────────────────────────
  const statusCount = { PENDING: 0, INTERVIEW: 0, ACCEPTED: 0, REJECTED: 0 };
  for (const a of applications) {
    statusCount[a.status as keyof typeof statusCount]++;
  }
  const pipeline = [
    { label: "รอพิจารณา", count: statusCount.PENDING, color: "#F59E0B" },
    { label: "นัดสัมภาษณ์", count: statusCount.INTERVIEW, color: "#6366F1" },
    { label: "รับเข้าทำงาน", count: statusCount.ACCEPTED, color: "#10B981" },
    { label: "ไม่ผ่านการคัดเลือก", count: statusCount.REJECTED, color: "#EF4444" },
  ];

  // ─── Daily Trend (7 วันล่าสุด) ────────────────────────────────────────────
  const days: { date: string; views: number; applicants: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD

    const thaiMonth = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];
    const label = `${d.getDate()} ${thaiMonth[d.getMonth()]}`;

    const viewsOnDay = jobViews.filter(
      (v) => v.viewedAt.toISOString().split("T")[0] === dateStr,
    ).length;
    const applicantsOnDay = applications.filter(
      (a) => a.appliedAt.toISOString().split("T")[0] === dateStr,
    ).length;

    days.push({ date: label, views: viewsOnDay, applicants: applicantsOnDay });
  }

  // ─── Experience Levels ────────────────────────────────────────────────────
  const expBuckets: Record<string, number> = {
    "0–2 ปี": 0,
    "3–5 ปี": 0,
    "6–10 ปี": 0,
    "10 ปีขึ้นไป": 0,
    "ไม่ระบุ": 0,
  };
  for (const a of applications) {
    const exp = a.applicant.teachingExperience ?? "";
    if (exp.includes("1") || exp.includes("2") || exp === "0–2 ปี" || exp.includes("น้อยกว่า")) {
      expBuckets["0–2 ปี"]++;
    } else if (exp.includes("3") || exp.includes("4") || exp.includes("5") || exp.includes("3-5") || exp.includes("3–5")) {
      expBuckets["3–5 ปี"]++;
    } else if (exp.includes("6") || exp.includes("7") || exp.includes("8") || exp.includes("9") || exp.includes("10") || exp.includes("6-10") || exp.includes("6–10")) {
      expBuckets["6–10 ปี"]++;
    } else if (exp.includes("10+") || exp.includes("10 ปีขึ้นไป") || exp.includes("มากกว่า 10")) {
      expBuckets["10 ปีขึ้นไป"]++;
    } else if (exp !== "") {
      expBuckets["ไม่ระบุ"]++;
    } else {
      expBuckets["ไม่ระบุ"]++;
    }
  }
  const experienceLevels = Object.entries(expBuckets).map(([label, count]) => ({
    label,
    count,
    percent: totalApplicants > 0 ? Math.round((count / totalApplicants) * 100) : 0,
  }));

  return {
    jobId: job.id,
    jobTitle: job.title,
    publishedAt: job.createdAt.toISOString().split("T")[0],
    expiresAt: job.deadline ? job.deadline.toISOString().split("T")[0] : "-",
    totalViews,
    totalApplicants,
    newApplicants,
    conversionRate,
    avgTimeToApply: "-", // ❌ DB ไม่เก็บข้อมูลนี้
    pipeline,
    dailyTrend: days,
    sources: [],         // ❌ DB ไม่เก็บแหล่งที่มา
    experienceLevels,
  };
};
