import { useEffect, useState } from "react";
import { useToastStore } from "../../store/toastStore";

function UndoToastRow({ id, message, onUndo, durationMs }: { id: string; message: string; onUndo?: () => void; durationMs: number }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [visible, setVisible] = useState(false);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      setVisible(true);
      const raf2 = requestAnimationFrame(() => setCounting(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  return (
    <div className={visible ? "undo-toast visible" : "undo-toast"}>
      <span>{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            onUndo();
            dismiss(id);
          }}
        >
          Undo
        </button>
      )}
      {onUndo && (
        <div className={counting ? "undo-toast-progress counting" : "undo-toast-progress"} style={{ transitionDuration: `${durationMs}ms` }} />
      )}
    </div>
  );
}

function MilestoneToastRow({ message }: { message: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div className={visible ? "milestone-toast visible" : "milestone-toast"}>{message}</div>;
}

/** Milestone/perfect-day/undo/error toasts all share this stack so simultaneous toasts queue instead of overlapping. */
export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="toast-stack">
      {toasts.map((t) =>
        t.kind === "milestone" ? (
          <MilestoneToastRow key={t.id} message={t.message} />
        ) : (
          <UndoToastRow key={t.id} id={t.id} message={t.message} onUndo={t.onUndo} durationMs={t.durationMs} />
        )
      )}
    </div>
  );
}
