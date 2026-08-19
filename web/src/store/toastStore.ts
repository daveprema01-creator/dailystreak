import { create } from "zustand";

export type ToastKind = "undo" | "info" | "milestone";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  /** Present only for kind "undo". */
  onUndo?: () => void;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function showUndoToast(message: string, onUndo: () => void, durationMs = 5000) {
  const id = useToastStore.getState().push({ kind: "undo", message, onUndo, durationMs });
  setTimeout(() => useToastStore.getState().dismiss(id), durationMs);
  return id;
}

export function showInfoToast(message: string, durationMs = 5000) {
  const id = useToastStore.getState().push({ kind: "info", message, durationMs });
  setTimeout(() => useToastStore.getState().dismiss(id), durationMs);
  return id;
}

export function showMilestoneToast(message: string, durationMs = 2600) {
  const id = useToastStore.getState().push({ kind: "milestone", message, durationMs });
  setTimeout(() => useToastStore.getState().dismiss(id), durationMs);
  return id;
}
