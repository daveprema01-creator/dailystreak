import { supabase } from "../lib/supabase";
import { habitToRow, rowToHabit, type HabitRow } from "../lib/habits";
import type { HabitsApi } from "./habitsApi";

export const supabaseHabitsApi: HabitsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from("habits").select("*").order("position", { ascending: true });
    if (error) throw error;
    return (data as HabitRow[]).map(rowToHabit);
  },

  async insert(habit, _allHabitsAfter, userId) {
    if (!userId) throw new Error("insert requires a userId");
    const { error } = await supabase.from("habits").insert(habitToRow(habit, userId));
    if (error) throw error;
  },

  async updateFields(id, fields, _allHabitsAfter) {
    const { error } = await supabase.from("habits").update(fields).eq("id", id);
    if (error) throw error;
  },

  async remove(id, _allHabitsAfter) {
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) throw error;
  },

  // `position` is a DB-only identity column — this writes habitsCache's own array order
  // back onto every row so ORDER BY position on next fetch matches. Used by drag-reorder
  // and to realign a restored (undo-delete) row, which the identity column always appends
  // at the end of otherwise.
  async reorder(habits) {
    const results = await Promise.all(
      habits.map((h, i) => supabase.from("habits").update({ position: i }).eq("id", h.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  },

  async replaceAll(habits, userId) {
    if (!userId) throw new Error("replaceAll requires a userId");
    const { error: deleteError } = await supabase.from("habits").delete().eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (habits.length === 0) return;
    const { error: insertError } = await supabase.from("habits").insert(habits.map((h) => habitToRow(h, userId)));
    if (insertError) throw insertError;
  },
};

/**
 * Another user's shared, active habits — for their /u/:username page. The `shared`/
 * `archived_at` filters here are just intent; `habits_shared_read` RLS is what actually
 * enforces that this returns nothing unless the caller is an accepted follower.
 */
export async function fetchSharedHabits(userId: string) {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .eq("shared", true)
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as HabitRow[]).map(rowToHabit);
}
