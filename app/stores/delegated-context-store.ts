import { create } from "zustand";
import { persist } from "zustand/middleware";

// ✨ ข้อมูล delegated access ที่ active อยู่
export interface DelegatedContext {
  orgMemberId: string;        // id ของ OrgMember record
  schoolProfileId: string;    // schoolProfileId ของโรงเรียนที่ถูก delegate
  schoolName: string;
  schoolLogoUrl?: string | null;
  roleName: string;
  roleColor?: string;
  permissions: string[];      // ["jobs:create", "jobs:read", ...]
}

interface DelegatedContextStore {
  active: DelegatedContext | null;
  enterDelegation: (context: DelegatedContext) => void;
  exitDelegation: () => void;
}

// ✨ persisted — ยังคงอยู่หลัง refresh ตราบที่ยัง login อยู่
export const useDelegatedContextStore = create<DelegatedContextStore>()(
  persist(
    (set) => ({
      active: null,
      enterDelegation: (context) => set({ active: context }),
      exitDelegation: () => set({ active: null }),
    }),
    { name: "delegated-context-store" },
  ),
);
