import type { Habit, HabitRow } from "../lib/habits";
import { localHabitsApi } from "./localHabitsApi";
import { supabaseHabitsApi } from "./supabaseHabitsApi";

/**
 * Both backends conform to this shape. Every method that mutates a single habit also
 * receives the FULL habits array as it stands after that mutation was already applied
 * in-memory (by the caller, optimistically) — the Supabase backend ignores it except for
 * `reorder`; the localStorage backend uses it as the thing to serialize wholesale, since
 * localStorage isn't row-addressable the way a table is.
 */
export interface HabitsApi {
  fetchAll(userId?: string): Promise<Habit[]>;
  insert(habit: Habit, allHabitsAfter: Habit[], userId?: string): Promise<void>;
  updateFields(id: string, fields: Partial<HabitRow>, allHabitsAfter: Habit[]): Promise<void>;
  remove(id: string, allHabitsAfter: Habit[]): Promise<void>;
  /** Bulk-writes the position of every habit to match `habits`' own array order. */
  reorder(habits: Habit[], userId?: string): Promise<void>;
  /** Wholesale delete-then-insert, used by backup-style bulk replace flows. */
  replaceAll(habits: Habit[], userId?: string): Promise<void>;
}

export function getHabitsApi(signedIn: boolean): HabitsApi {
  return signedIn ? supabaseHabitsApi : localHabitsApi;
}
