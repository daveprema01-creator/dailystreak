import { useMemo, useState, type DragEvent } from "react";
import { useHabits } from "../hooks/useHabits";
import { useSessionStore } from "../store/sessionStore";
import { pickAtRiskHabit, todayKey, type Habit } from "../lib/habits";
import { HeroBand } from "../components/layout/HeroBand";
import { HabitCard } from "../components/habit/HabitCard";
import { RestDayOfferCard } from "../components/habit/RestDayOfferCard";
import { ArchiveList } from "../components/habit/ArchiveList";
import { HabitForm, type HabitFormValues } from "../components/habit/HabitForm";
import { HistoryModal } from "../components/habit/HistoryModal";
import { Modal } from "../components/ui/Modal";

export function PersonalDashboard() {
  const signedIn = !!useSessionStore((s) => s.user);
  const {
    activeHabits,
    archivedHabits,
    isLoading,
    restOffer,
    dismissRestOffer,
    addHabit,
    deleteHabit,
    toggleCompletionOnDate,
    undoLastCompletion,
    useRestDay,
    archiveHabit,
    unarchiveHabit,
    saveHabitEdits,
    reorderHabits,
  } = useHabits();

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [historyHabitId, setHistoryHabitId] = useState<string | null>(null);
  const [editHabitId, setEditHabitId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const atRiskCandidates = restOffer ? activeHabits.filter((h) => h.id !== restOffer.habit.id) : activeHabits;
  const atRisk = pickAtRiskHabit(atRiskCandidates);

  const pinnedIds = useMemo(() => {
    const ids: string[] = [];
    if (restOffer) ids.push(restOffer.habit.id);
    if (atRisk && atRisk.habit.id !== restOffer?.habit.id) ids.push(atRisk.habit.id);
    return ids;
  }, [restOffer, atRisk]);

  const baseOrder = localOrder ?? activeHabits.map((h) => h.id);
  const orderedHabits: Habit[] = useMemo(() => {
    const byId = new Map(activeHabits.map((h) => [h.id, h]));
    const pinned = pinnedIds.map((id) => byId.get(id)).filter(Boolean) as Habit[];
    const rest = baseOrder.filter((id) => !pinnedIds.includes(id)).map((id) => byId.get(id)).filter(Boolean) as Habit[];
    return [...pinned, ...rest];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHabits, baseOrder, pinnedIds]);

  const historyHabit = activeHabits.find((h) => h.id === historyHabitId) ?? null;
  const editHabit = activeHabits.find((h) => h.id === editHabitId) ?? null;

  function handleDragStart(id: string) {
    setDraggingId(id);
    setLocalOrder(activeHabits.map((h) => h.id));
  }

  function handleDragOverCard(e: DragEvent<HTMLDivElement>, overId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === overId || pinnedIds.includes(overId) || pinnedIds.includes(draggingId)) return;
    setLocalOrder((prev) => {
      const order = prev ?? activeHabits.map((h) => h.id);
      const from = order.indexOf(draggingId);
      const to = order.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return order;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, draggingId);
      return next;
    });
  }

  function handleDragEnd() {
    if (localOrder) reorderHabits(localOrder);
    setDraggingId(null);
    setLocalOrder(null);
  }

  function handleAdd(values: HabitFormValues) {
    addHabit(values.name, values.target, values.periodValue, values.periodUnit);
    setAddFormOpen(false);
  }

  function handleEditSubmit(values: HabitFormValues) {
    if (!editHabitId) return;
    saveHabitEdits(editHabitId, values);
    setEditHabitId(null);
  }

  if (isLoading) {
    return (
      <div className="main-view">
        <HeroBand habits={[]} />
      </div>
    );
  }

  return (
    <div className="main-view">
      <HeroBand habits={activeHabits} />

      <main id="main-content">
        <div className="habit-grid-wrap">
          <div className="habit-list" id="habit-list">
            {restOffer && restOffer.habit.id === orderedHabits[0]?.id && (
              <RestDayOfferCard
                offer={restOffer}
                onUse={() => useRestDay(restOffer.habit.id, restOffer)}
                onDismiss={() => dismissRestOffer(restOffer.key)}
              />
            )}
            {orderedHabits
              .filter((h) => !(restOffer && restOffer.habit.id === h.id))
              .map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  atRisk={atRisk}
                  draggable
                  dragging={draggingId === habit.id}
                  onDragStart={() => handleDragStart(habit.id)}
                  onDragOver={(e) => handleDragOverCard(e, habit.id)}
                  onDragEnd={handleDragEnd}
                  onComplete={(id) => toggleCompletionOnDate(id, todayKey())}
                  onUndo={undoLastCompletion}
                  onEdit={setEditHabitId}
                  onArchive={archiveHabit}
                  onDelete={deleteHabit}
                  onToggleDate={toggleCompletionOnDate}
                  onViewHistory={setHistoryHabitId}
                />
              ))}
          </div>

          {activeHabits.length === 0 && archivedHabits.length === 0 && (
            <p className="empty-state" style={{ display: "block" }}>
              No habits yet. Add your first one above to get started.
            </p>
          )}

          {!addFormOpen ? (
            <button type="button" className="add-habit-toggle" onClick={() => setAddFormOpen(true)}>
              + Add a habit
            </button>
          ) : (
            <HabitForm mode="add" onSubmit={handleAdd} />
          )}

          <ArchiveList archived={archivedHabits} onUnarchive={unarchiveHabit} onDelete={deleteHabit} />
        </div>
      </main>

      <HistoryModal habit={historyHabit} onClose={() => setHistoryHabitId(null)} />

      <Modal open={!!editHabit} onClose={() => setEditHabitId(null)} wide>
        <button className="modal-close-btn" aria-label="Close" onClick={() => setEditHabitId(null)}>
          ✕
        </button>
        <div className="edit-habit-header">
          <span className="edit-habit-icon">✎</span>
          <div>
            <h2>Edit habit</h2>
            {editHabit && <p className="edit-habit-subtitle">Fine-tune "{editHabit.name}"</p>}
          </div>
        </div>
        {editHabit && (
          <HabitForm
            mode="edit"
            initial={{
              name: editHabit.name,
              target: editHabit.target,
              periodValue: editHabit.periodValue,
              periodUnit: editHabit.periodUnit,
              restDayAllowance: editHabit.restDayAllowance,
              shared: editHabit.shared,
            }}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditHabitId(null)}
            showSharing={signedIn}
          />
        )}
      </Modal>
    </div>
  );
}
