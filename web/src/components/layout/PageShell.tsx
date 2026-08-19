import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="weekly-review-view visible">
      <div className="review-inner">
        <Link to="/" className="review-back-btn">
          ‹ Back
        </Link>
        {children}
      </div>
    </div>
  );
}
