import type { Habit } from "../lib/habits";
import { HABITS_KEY } from "../lib/storageKeys";
import type { HabitsApi } from "./habitsApi";

function loadLocalHabits(): Habit[] {
  const raw = localStorage.getItem(HABITS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("Daily Streak: saved habit data was corrupted and has been reset.");
    return [];
  }
}

function saveLocalHabits(habits: Habit[]): void {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

// localStorage isn't row-addressable, so every mutation just re-serializes the full
// (already-mutated) array the caller hands back — matching the vanilla app's
// saveLocalHabits(habitsCache) pattern.
export const localHabitsApi: HabitsApi = {
  async fetchAll() {
    return loadLocalHabits();
  },
  async insert(_habit, allHabitsAfter) {
    saveLocalHabits(allHabitsAfter);
  },
  async updateFields(_id, _fields, allHabitsAfter) {
    saveLocalHabits(allHabitsAfter);
  },
  async remove(_id, allHabitsAfter) {
    saveLocalHabits(allHabitsAfter);
  },
  async reorder(habits) {
    saveLocalHabits(habits);
  },
  async replaceAll(habits) {
    saveLocalHabits(habits);
  },
};
