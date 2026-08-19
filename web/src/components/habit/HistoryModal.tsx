import { useRef } from "react";
import {
  calcStreak,
  completionRate,
  getPeriod,
  getTarget,
  heatmapLevel,
  longestStreak,
  periodDays,
  periodPhrase,
  totalCompletions,
  buildHeatmap,
  type Habit,
} from "../../lib/habits";
import { Modal } from "../ui/Modal";
import { WeekMap } from "./WeekMap";

interface HistoryModalProps {
  habit: Habit | null;
  onClose: () => void;
}

async function shareHabitImage(habit: Habit) {
  if (document.fonts?.ready) await document.fonts.ready;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const fairShare = target / days;
  const restDays = habit.restDays || [];
  const streak = calcStreak(habit.completions, target, days, restDays);
  const weeksData = buildHeatmap(habit.completions, 12);

  const W = 600;
  const H = 340;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#201515";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fffefb";
  ctx.font = "600 26px Inter, sans-serif";
  ctx.fillText(habit.name, 32, 52);

  ctx.fillStyle = "#ff4f00";
  ctx.font = "500 56px Inter, sans-serif";
  const streakText = String(streak);
  ctx.fillText(streakText, 32, 118);
  const streakWidth = ctx.measureText(streakText).width;

  ctx.fillStyle = "#939084";
  ctx.font = "400 16px Inter, sans-serif";
  ctx.fillText(streak === 1 ? "day streak" : "days unbroken", 32 + streakWidth + 12, 118);
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillText(`${target}× every ${periodPhrase(period)}`, 32, 144);

  const cellSize = 12;
  const gap = 3;
  const startX = 32;
  const startY = 170;
  weeksData.forEach((week, wi) => {
    week.forEach(({ date, count }, di) => {
      const isRested = restDays.includes(date);
      const level = heatmapLevel(count, fairShare);
      let color = "rgba(255,255,255,0.1)";
      if (isRested) color = "#939084";
      else if (level > 0) color = "#ff6a24";
      ctx.fillStyle = color;
      const x = startX + wi * (cellSize + gap);
      const y = startY + di * (cellSize + gap);
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 2);
      ctx.fill();
    });
  });

  ctx.fillStyle = "#939084";
  ctx.font = "500 13px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Daily Streak", W - 32, H - 24);
  ctx.textAlign = "left";

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = habit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    a.download = `${slug || "habit"}-streak.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export function HistoryModal({ habit, onClose }: HistoryModalProps) {
  const shareInFlight = useRef(false);

  if (!habit) return null;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);

  return (
    <Modal open={!!habit} onClose={onClose} wide>
      <button className="modal-close-btn" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <h2>{habit.name}</h2>
      <div className="history-stats">
        <div className="history-stat">
          <span className="history-stat-value">{calcStreak(habit.completions, target, days, habit.restDays || [])}</span>
          <span className="history-stat-label">Current streak</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{longestStreak(habit)}</span>
          <span className="history-stat-label">Longest streak</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{totalCompletions(habit)}</span>
          <span className="history-stat-label">Total completions</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{completionRate(habit)}%</span>
          <span className="history-stat-label">Completion rate</span>
        </div>
      </div>
      <div className="heatmap-scroll">
        <WeekMap habit={habit} size="large" />
      </div>
      <button
        type="button"
        className="history-share-btn"
        onClick={async () => {
          if (shareInFlight.current) return;
          shareInFlight.current = true;
          try {
            await shareHabitImage(habit);
          } finally {
            shareInFlight.current = false;
          }
        }}
      >
        Share as image
      </button>
    </Modal>
  );
}
