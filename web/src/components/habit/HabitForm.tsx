import { useState, type FormEvent } from "react";
import type { PeriodUnit } from "../../lib/habits";

const SUGGESTIONS = ["Drink water", "Read", "Exercise", "Sleep 8 hours"];

export interface HabitFormValues {
  name: string;
  target: number;
  periodValue: number;
  periodUnit: PeriodUnit;
  restDayAllowance?: number;
  shared?: boolean;
}

interface HabitFormProps {
  mode: "add" | "edit";
  initial?: HabitFormValues;
  onSubmit: (values: HabitFormValues) => void;
  onCancel?: () => void;
  /** Signed-in only — guests have no followers, so there's nothing to share with. */
  showSharing?: boolean;
}

export function HabitForm({ mode, initial, onSubmit, onCancel, showSharing }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial?.target ?? 1);
  const [periodValue, setPeriodValue] = useState(initial?.periodValue ?? 1);
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>(initial?.periodUnit ?? "day");
  const [restDayAllowance, setRestDayAllowance] = useState(initial?.restDayAllowance ?? 3);
  const [shared, setShared] = useState(initial?.shared ?? false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      target: Math.max(1, target || 1),
      periodValue: Math.max(1, periodValue || 1),
      periodUnit,
      ...(mode === "edit" ? { restDayAllowance: Math.max(0, restDayAllowance || 0) } : {}),
      ...(showSharing ? { shared } : {}),
    });
    if (mode === "add") {
      setName("");
      setTarget(1);
      setPeriodValue(1);
      setPeriodUnit("day");
      setShared(false);
    }
  }

  const goalRow = (
    <div className={mode === "add" ? "add-habit-goal" : "modal-goal-row"}>
      <span>Goal:</span>
      <input type="number" min={1} max={99} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
      <span>time(s) every</span>
      <input
        type="number"
        min={1}
        max={99}
        value={periodValue}
        onChange={(e) => setPeriodValue(Number(e.target.value))}
      />
      <select value={periodUnit} onChange={(e) => setPeriodUnit(e.target.value as PeriodUnit)}>
        <option value="day">day(s)</option>
        <option value="week">week(s)</option>
        <option value="month">month(s)</option>
      </select>
    </div>
  );

  if (mode === "add") {
    return (
      <form className="add-habit-form visible" onSubmit={handleSubmit}>
        <div className="habit-suggestions">
          <span className="habit-suggestions-label">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button type="button" key={s} className="habit-chip" onClick={() => setName(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="add-habit-main">
          <input
            type="text"
            placeholder="Add a new habit… (e.g. Drink water)"
            autoComplete="off"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit">Add</button>
        </div>
        {goalRow}
        {showSharing && (
          <div className="modal-share-row" style={{ padding: "10px 4px 0" }}>
            <label htmlFor="add-shared-input">Share with followers</label>
            <label className="toggle-switch">
              <input
                id="add-shared-input"
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </label>
          </div>
        )}
      </form>
    );
  }

  return (
    <form className="edit-habit-form" onSubmit={handleSubmit}>
      <div className="field-group">
        <label className="field-label" htmlFor="edit-habit-name-input">
          Habit name
        </label>
        <input
          id="edit-habit-name-input"
          type="text"
          placeholder="Habit name"
          autoComplete="off"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="field-group">
        <label className="field-label">Goal</label>
        <div className="modal-goal-row">
          <input type="number" min={1} max={99} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          <span>time(s) every</span>
          <input
            type="number"
            min={1}
            max={99}
            value={periodValue}
            onChange={(e) => setPeriodValue(Number(e.target.value))}
          />
          <select value={periodUnit} onChange={(e) => setPeriodUnit(e.target.value as PeriodUnit)}>
            <option value="day">day(s)</option>
            <option value="week">week(s)</option>
            <option value="month">month(s)</option>
          </select>
        </div>
      </div>

      <div className="field-group">
        <div className="modal-rest-row">
          <label htmlFor="edit-rest-allowance-input">Rest days per month</label>
          <input
            id="edit-rest-allowance-input"
            type="number"
            min={0}
            max={31}
            value={restDayAllowance}
            onChange={(e) => setRestDayAllowance(Number(e.target.value))}
          />
        </div>
        <p className="modal-rest-hint">
          Spend a rest day to credit a missed period without breaking your streak — it doesn't count as a real
          completion.
        </p>
      </div>

      {showSharing && (
        <div className="field-group">
          <div className="modal-share-row">
            <label htmlFor="edit-shared-input">Share with followers</label>
            <label className="toggle-switch">
              <input
                id="edit-shared-input"
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </label>
          </div>
          <p className="modal-rest-hint">
            {shared
              ? "Followers you've accepted can see this habit's progress and milestones on your profile."
              : "Only you can see this habit — turn on to show it on your profile and share milestones in the feed."}
          </p>
        </div>
      )}

      <div className="modal-btn-row">
        <button type="button" className="modal-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
