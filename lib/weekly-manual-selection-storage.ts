"use client";

import { z } from "zod";

const STORAGE_KEY = "dinnermenu:weekly-manual-selection:v1";

export interface ManualWeeklySelection {
  dayIndex: number;
  mainKey: string;
  sideKey: string;
}

const manualSelectionSchema = z.object({
  dayIndex: z.number().int().min(1).max(7),
  mainKey: z.string(),
  sideKey: z.string(),
});

const storedManualSelectionSchema = z.object({
  savedAt: z.number(),
  selections: z.array(manualSelectionSchema).length(7),
});

export interface StoredManualSelections {
  selections: ManualWeeklySelection[];
  savedAt: number;
}

function normalizeSelections(
  selections: ManualWeeklySelection[]
): ManualWeeklySelection[] {
  const byDay = new Map(selections.map((selection) => [selection.dayIndex, selection]));
  return Array.from({ length: 7 }, (_, index) => ({
    dayIndex: index + 1,
    mainKey: "",
    sideKey: "",
  })).map((empty) => {
    const selection = byDay.get(empty.dayIndex);
    return selection ?? empty;
  });
}

export function loadManualSelections(): StoredManualSelections | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = storedManualSelectionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      selections: normalizeSelections(parsed.data.selections),
      savedAt: parsed.data.savedAt,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveManualSelections(selections: ManualWeeklySelection[]): number {
  const savedAt = Date.now();
  if (typeof window === "undefined") return savedAt;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedAt,
        selections: normalizeSelections(selections),
      })
    );
  } catch {
    // localStorage容量超過等は握り潰す
  }
  return savedAt;
}

export function clearManualSelections(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
