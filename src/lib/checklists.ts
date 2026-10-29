import { ResourceCategory, ConditionGrade } from "@/types/db";

export const CATEGORY_CHECKLISTS: Record<ResourceCategory, string[]> = {
  equipment: [
    "Powers on and functions normally",
    "All accessories, leads, and adapters present",
    "No visible structural cracks or housing damage",
    "Emergency shut-off and safety guards functional",
  ],
  room: [
    "Room clean and waste disposed in bins",
    "Furniture arranged in standard layout",
    "Projector and display screens operational",
    "Microphones, speakers, and AV rack functional",
  ],
  lab: [
    "Workbench clean and free of residue",
    "Apparatus and glassware intact and undamaged",
    "Safety gear (fume extractor, wrist strap, goggles) ready",
    "Components and tool trays returned to assigned slots",
  ],
  computing: [
    "Workstation boots cleanly to OS login",
    "Monitors, keyboard, mouse, and power bricks connected",
    "Chassis vents unobstructed and cooling operational",
    "No physical port, cable, or enclosure damage",
  ],
  media: [
    "Camera lens element clean and scratch-free",
    "Rechargeable batteries charged and secured in bay",
    "Memory cards formatted and functional",
    "Fluid head tripod, mic receivers, and cables in hardcase",
  ],
};

export const GRADE_RANKS: Record<ConditionGrade, number> = {
  excellent: 4,
  good: 3,
  fair: 2,
  damaged: 1,
};

export interface ChecklistComparisonItem {
  item: string;
  checkoutPassed: boolean;
  returnPassed: boolean;
  regressed: boolean;
}

export interface ConditionComparisonResult {
  items: ChecklistComparisonItem[];
  hasChecklistRegression: boolean;
  gradeWorse: boolean;
  isConditionDegraded: boolean;
  checkoutGrade?: ConditionGrade;
  returnGrade?: ConditionGrade;
}

/**
 * Compares checkout and return condition reports to highlight differences and regressions.
 */
export function compareConditionReports(
  checkoutReport?: {
    grade: ConditionGrade;
    checklist?: Record<string, boolean> | null;
  } | null,
  returnReport?: {
    grade: ConditionGrade;
    checklist?: Record<string, boolean> | null;
  } | null,
  category: ResourceCategory = "equipment"
): ConditionComparisonResult {
  const defaultItems = CATEGORY_CHECKLISTS[category] || CATEGORY_CHECKLISTS.equipment;
  const checkoutList = checkoutReport?.checklist || {};
  const returnList = returnReport?.checklist || {};

  const allKeys = Array.from(
    new Set([...defaultItems, ...Object.keys(checkoutList), ...Object.keys(returnList)])
  );

  let hasChecklistRegression = false;

  const items: ChecklistComparisonItem[] = allKeys.map((item) => {
    // If not specified in checkout, assume true if grade was excellent/good
    const checkoutPassed = checkoutList[item] !== undefined ? Boolean(checkoutList[item]) : true;
    const returnPassed = returnList[item] !== undefined ? Boolean(returnList[item]) : true;
    const regressed = checkoutPassed && !returnPassed;

    if (regressed) {
      hasChecklistRegression = true;
    }

    return {
      item,
      checkoutPassed,
      returnPassed,
      regressed,
    };
  });

  const checkoutRank = checkoutReport ? GRADE_RANKS[checkoutReport.grade] || 3 : 3;
  const returnRank = returnReport ? GRADE_RANKS[returnReport.grade] || 3 : 3;
  const gradeWorse = returnRank < checkoutRank;

  return {
    items,
    hasChecklistRegression,
    gradeWorse,
    isConditionDegraded: hasChecklistRegression || gradeWorse,
    checkoutGrade: checkoutReport?.grade,
    returnGrade: returnReport?.grade,
  };
}

