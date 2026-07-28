import { create } from 'zustand';

export type CaseDetailNavSection = {
  id: string;
  label: string;
};

type CaseDetailNavState = {
  caseId: string | null;
  sections: CaseDetailNavSection[];
  activeSectionId: string | null;
  setNav: (caseId: string, sections: CaseDetailNavSection[]) => void;
  setActiveSection: (id: string | null) => void;
  clear: () => void;
};

export const useCaseDetailNav = create<CaseDetailNavState>((set) => ({
  caseId: null,
  sections: [],
  activeSectionId: null,
  setNav: (caseId, sections) => set({ caseId, sections }),
  setActiveSection: (activeSectionId) => set({ activeSectionId }),
  clear: () => set({ caseId: null, sections: [], activeSectionId: null }),
}));
