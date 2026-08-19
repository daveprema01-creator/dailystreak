import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import { getHabitsApi } from "../api/habitsApi";
import { supabaseHabitsApi } from "../api/supabaseHabitsApi";
import { insertActivityEvent } from "../api/activityApi";
import { supabase } from "../lib/supabase";
import { showInfoToast, showMilestoneToast, showUndoToast } from "../store/toastStore";
import { LAST_PERFECT_DAY_KEY } from "../lib/storageKeys";
import {
  type Habit,
  type HabitRow,
  type PeriodUnit,
  STREAK_MILESTONES,
  allHabitsMetToday,
  backfillCreatedAt,
  calcStreak,
  countOnDate,
  formatDate,
  getPeriod,
  getTarget,
  newHabit,
  periodDays,
  pickRestOfferHabit,
  rowToHabit,
  todayKey,
  type RestOfferInfo,
} from "../lib/habits";

function queryKey(userId: string | undefined) {
  return ["habits", userId ?? "guest"] as const;
}

interface PendingDelete {
  habit: Habit;
  index: number;
}

export function useHabits() {
  const user = useSessionStore((s) => s.user);
  const bootstrapped = useSessionStore((s) => s.bootstrapped);
  const userId = user?.id;
  const signedIn = !!user;
  const queryClient = useQueryClient();
  const key = queryKey(userId);
  const api = getHabitsApi(signedIn);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const fetched = await api.fetchAll(userId);
      // Legacy habits with no createdAt reset their creation-anchored period grid on every
      // load unless backfilled once from the earliest completion.
      const needsSave = fetched.filter((h) => backfillCreatedAt(h));
      if (needsSave.length > 0) {
        if (signedIn && userId) {
          await Promise.all(
            needsSave.map((h) => supabaseHabitsApi.updateFields(h.id, { created_at: h.createdAt }, fetched))
          );
        } else {
          await api.insert(fetched[0] ?? ({} as Habit), fetched); // local backend ignores args, just re-saves the array
        }
      }
      return fetched;
    },
    enabled: bootstrapped,
    staleTime: Infinity,
  });

  const habits = useMemo(() => query.data ?? [], [query.data]);
  const activeHabits = useMemo(() => habits.filter((h) => !h.archivedAt), [habits]);
  const archivedHabits = useMemo(() => habits.filter((h) => h.archivedAt), [habits]);

  const setHabits = useCallback(
    (next: Habit[]) => queryClient.setQueryData<Habit[]>(key, next),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId]
  );

  const getCurrent = useCallback((): Habit[] => queryClient.getQueryData<Habit[]>(key) ?? [], [queryClient, key]);

  // --- Realtime: keeps two tabs/devices on the same account from silently diverging ---
  useEffect(() => {
    if (!signedIn || !userId) return;
    const channel = supabase
      .channel(`habits-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habits", filter: `user_id=eq.${userId}` },
        (payload) => {
          const current = getCurrent();
          if (payload.eventType === "INSERT") {
            const row = payload.new as HabitRow;
            if (!current.some((h) => h.id === row.id)) {
              queryClient.setQueryData<Habit[]>(key, [...current, rowToHabit(row)]);
            }
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as HabitRow;
            const idx = current.findIndex((h) => h.id === row.id);
            if (idx !== -1) {
              const next = [...current];
              next[idx] = rowToHabit(row);
              queryClient.setQueryData<Habit[]>(key, next);
            }
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<HabitRow>;
            queryClient.setQueryData<Habit[]>(
              key,
              current.filter((h) => h.id !== oldRow.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, userId]);

  // --- First sign-in: offer to bulk-copy local guest habits into a freshly signed-in, empty account ---
  const prevUserId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!bootstrapped) return;
    const justSignedIn = !!userId && !prevUserId.current;
    prevUserId.current = userId;
    if (!justSignedIn || !userId) return;

    (async () => {
      const localRaw = localStorage.getItem("daily-streak-habits");
      const localHabits: Habit[] = localRaw ? JSON.parse(localRaw) : [];
      if (localHabits.length === 0) return;
      const cloudHabits = await supabaseHabitsApi.fetchAll(userId);
      if (cloudHabits.length > 0) return;
      const ok = confirm(`Import your ${localHabits.length} local habit(s) into this account?`);
      if (!ok) return;
      await supabaseHabitsApi.replaceAll(localHabits, userId);
      queryClient.setQueryData<Habit[]>(key, localHabits);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, bootstrapped]);

  // --- Rest-day offer (derived, not persisted — dismissal is session-only) ---
  const [dismissedOffers, setDismissedOffers] = useState<Set<string>>(new Set());
  const restOffer: RestOfferInfo | null = useMemo(
    () => pickRestOfferHabit(activeHabits, dismissedOffers),
    [activeHabits, dismissedOffers]
  );
  const dismissRestOffer = useCallback((offerKey: string) => {
    setDismissedOffers((prev) => new Set(prev).add(offerKey));
  }, []);

  // --- Mutations ---

  const addHabit = useCallback(
    async (name: string, target: number, periodValue: number, periodUnit: PeriodUnit) => {
      const habit = newHabit(name, target, periodValue, periodUnit);
      const next = [...getCurrent(), habit];
      setHabits(next);
      try {
        await api.insert(habit, next, userId);
      } catch (err) {
        showInfoToast(`Couldn't save "${name}" — ${(err as Error).message}`);
      }
    },
    [api, getCurrent, setHabits, userId]
  );

  const pendingDeletes = useRef<Map<string, PendingDelete>>(new Map());

  const deleteHabit = useCallback(
    async (id: string) => {
      const current = getCurrent();
      const index = current.findIndex((h) => h.id === id);
      if (index === -1) return;
      const habit = current[index];
      const next = current.filter((h) => h.id !== id);
      setHabits(next);
      pendingDeletes.current.set(id, { habit, index });

      showUndoToast(`Deleted "${habit.name}"`, () => restoreHabit(id));

      try {
        await api.remove(id, next);
      } catch (err) {
        showInfoToast(`Couldn't delete "${habit.name}" — ${(err as Error).message}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, getCurrent, setHabits]
  );

  const restoreHabit = useCallback(
    async (id: string) => {
      const pending = pendingDeletes.current.get(id);
      if (!pending) return;
      pendingDeletes.current.delete(id);

      const current = getCurrent();
      const insertAt = Math.min(pending.index, current.length);
      const next = [...current];
      next.splice(insertAt, 0, pending.habit);
      setHabits(next);

      try {
        await api.insert(pending.habit, next, userId);
        if (signedIn) await api.reorder(next, userId);
      } catch (err) {
        showInfoToast(`Couldn't restore "${pending.habit.name}" — ${(err as Error).message}`);
      }
    },
    [api, getCurrent, setHabits, signedIn, userId]
  );

  const toggleCompletionOnDate = useCallback(
    async (id: string, dateStr: string) => {
      const current = getCurrent();
      const idx = current.findIndex((h) => h.id === id);
      if (idx === -1) return;
      const habit = { ...current[idx] };

      if ((habit.restDays || []).includes(dateStr)) return;
      if (habit.createdAt && dateStr < habit.createdAt) return;
      if (dateStr > todayKey()) return;

      const count = countOnDate(habit.completions, dateStr);
      let hitMilestone: number | null = null;

      if (count > 0) {
        const completions = [...habit.completions];
        const pos = completions.indexOf(dateStr);
        if (pos !== -1) completions.splice(pos, 1);
        habit.completions = completions;
      } else {
        habit.completions = [...habit.completions, dateStr];
        const days = periodDays(getPeriod(habit));
        const newStreak = calcStreak(habit.completions, getTarget(habit), days, habit.restDays || []);
        const milestonesHit = [...habit.milestonesHit];
        for (const m of STREAK_MILESTONES) {
          if (newStreak >= m && !milestonesHit.includes(m)) {
            milestonesHit.push(m);
            hitMilestone = m;
          }
        }
        habit.milestonesHit = milestonesHit;
      }

      const next = [...current];
      next[idx] = habit;
      setHabits(next);

      if (hitMilestone) showMilestoneToast(`${hitMilestone}-day streak on "${habit.name}"!`, 2600);

      const activeNext = next.filter((h) => !h.archivedAt);
      if (
        dateStr === todayKey() &&
        allHabitsMetToday(activeNext) &&
        localStorage.getItem(LAST_PERFECT_DAY_KEY) !== todayKey()
      ) {
        localStorage.setItem(LAST_PERFECT_DAY_KEY, todayKey());
        showMilestoneToast(`Perfect day! All ${activeNext.length} habit${activeNext.length === 1 ? "" : "s"} complete`, 3200);
      }

      try {
        await api.updateFields(
          id,
          { completions: habit.completions, milestones_hit: habit.milestonesHit },
          next
        );
      } catch (err) {
        showInfoToast(`Couldn't sync "${habit.name}" — ${(err as Error).message}`);
      }

      // Written at milestone-time rather than computed live when the feed loads, so there's
      // one implementation of "did a milestone happen" (this one) instead of two. Silent on
      // failure — this is supplementary feed data, not something the user consciously waits
      // on, so a toast here would just be noise.
      if (hitMilestone && signedIn && userId) {
        insertActivityEvent(userId, id, habit.name, hitMilestone, dateStr).catch((err) =>
          console.error("Couldn't log activity event:", err)
        );
      }
    },
    [api, getCurrent, setHabits, signedIn, userId]
  );

  // Removes the most recent completion within the current window, regardless of which day
  // it landed on — distinct from toggleCompletionOnDate, which targets one specific day.
  const undoLastCompletion = useCallback(
    async (id: string) => {
      const current = getCurrent();
      const idx = current.findIndex((h) => h.id === id);
      if (idx === -1) return;
      const habit = { ...current[idx] };

      const days = periodDays(getPeriod(habit));
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - (days - 1));
      const startStr = formatDate(windowStart);
      const endStr = todayKey();

      const completions = [...habit.completions];
      for (let i = completions.length - 1; i >= 0; i--) {
        const d = completions[i];
        if (d >= startStr && d <= endStr) {
          completions.splice(i, 1);
          break;
        }
      }
      habit.completions = completions;

      const next = [...current];
      next[idx] = habit;
      setHabits(next);

      try {
        await api.updateFields(id, { completions: habit.completions }, next);
      } catch (err) {
        showInfoToast(`Couldn't sync "${habit.name}" — ${(err as Error).message}`);
      }
    },
    [api, getCurrent, setHabits]
  );

  const useRestDay = useCallback(
    async (id: string, offer: RestOfferInfo) => {
      const current = getCurrent();
      const idx = current.findIndex((h) => h.id === id);
      if (idx === -1) return;
      const habit = { ...current[idx], restDays: [...current[idx].restDays, ...offer.blankDates] };
      const next = [...current];
      next[idx] = habit;
      setHabits(next);
      dismissRestOffer(offer.key);

      try {
        await api.updateFields(id, { rest_days: habit.restDays }, next);
      } catch (err) {
        showInfoToast(`Couldn't sync "${habit.name}" — ${(err as Error).message}`);
      }
    },
    [api, dismissRestOffer, getCurrent, setHabits]
  );

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const current = getCurrent();
      const idx = current.findIndex((h) => h.id === id);
      if (idx === -1) return;
      const archivedAt = archived ? new Date().toISOString() : null;
      const habit = { ...current[idx], archivedAt };
      const next = [...current];
      next[idx] = habit;
      setHabits(next);

      try {
        await api.updateFields(id, { archived_at: archivedAt }, next);
      } catch (err) {
        showInfoToast(`Couldn't update "${habit.name}" — ${(err as Error).message}`);
      }
    },
    [api, getCurrent, setHabits]
  );

  const saveHabitEdits = useCallback(
    async (
      id: string,
      edits: {
        name: string;
        target: number;
        periodValue: number;
        periodUnit: PeriodUnit;
        restDayAllowance?: number;
        shared?: boolean;
      }
    ) => {
      const current = getCurrent();
      const idx = current.findIndex((h) => h.id === id);
      if (idx === -1) return;
      const habit: Habit = {
        ...current[idx],
        name: edits.name,
        target: edits.target,
        periodValue: edits.periodValue,
        periodUnit: edits.periodUnit,
        ...(edits.restDayAllowance !== undefined ? { restDayAllowance: edits.restDayAllowance } : {}),
        ...(edits.shared !== undefined ? { shared: edits.shared } : {}),
      };
      const next = [...current];
      next[idx] = habit;
      setHabits(next);

      const fields: Partial<HabitRow> = {
        name: edits.name,
        target: edits.target,
        period_value: edits.periodValue,
        period_unit: edits.periodUnit,
      };
      if (edits.restDayAllowance !== undefined) fields.rest_day_allowance = edits.restDayAllowance;
      if (edits.shared !== undefined) fields.shared = edits.shared;

      try {
        await api.updateFields(id, fields, next);
      } catch (err) {
        showInfoToast(`Couldn't save changes to "${edits.name}" — ${(err as Error).message}`);
      }
    },
    [api, getCurrent, setHabits]
  );

  const reorderHabits = useCallback(
    async (orderedIds: string[]) => {
      const current = getCurrent();
      const reordered = orderedIds.map((id) => current.find((h) => h.id === id)).filter(Boolean) as Habit[];
      const missing = current.filter((h) => !orderedIds.includes(h.id));
      const next = [...reordered, ...missing];
      const changed = next.some((h, i) => h.id !== current[i]?.id);
      setHabits(next);
      if (!changed) return;
      try {
        await api.reorder(next, userId);
      } catch (err) {
        showInfoToast(`Couldn't save the new order — ${(err as Error).message}`);
      }
    },
    [api, getCurrent, setHabits, userId]
  );

  return {
    habits,
    activeHabits,
    archivedHabits,
    isLoading: query.isLoading,
    restOffer,
    dismissRestOffer,
    addHabit,
    deleteHabit,
    restoreHabit,
    toggleCompletionOnDate,
    undoLastCompletion,
    useRestDay,
    archiveHabit: (id: string) => setArchived(id, true),
    unarchiveHabit: (id: string) => setArchived(id, false),
    saveHabitEdits,
    reorderHabits,
  };
}
