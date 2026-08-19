import { useState } from "react";
import type { Habit } from "../../lib/habits";

interface ArchiveListProps {
  archived: Habit[];
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ArchiveList({ archived, onUnarchive, onDelete }: ArchiveListProps) {
  const [expanded, setExpanded] = useState(false);

  if (archived.length === 0) return null;

  return (
    <div className="archived-section">
      <button
        type="button"
        className="archived-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        Archived ({archived.length})
      </button>
      {expanded && (
        <div className="archived-list">
          {archived.map((habit) => (
            <div className="archived-row" key={habit.id}>
              <span className="archived-row-name">{habit.name}</span>
              <div className="archived-row-actions">
                <button type="button" className="archived-unarchive-btn" onClick={() => onUnarchive(habit.id)}>
                  Unarchive
                </button>
                <button
                  type="button"
                  className="archived-delete-btn"
                  aria-label="Delete habit"
                  onClick={() => onDelete(habit.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
