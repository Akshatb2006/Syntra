"use client";
import { useState } from "react";

const LOCK_MSG = "Available once the full version launches";

type Props = {
  label: string;
  /** Render as a nav-style button or an inline link-like span. */
  variant?: "nav" | "inline";
  /** Where the tooltip points relative to the trigger. */
  align?: "left" | "center";
};

/**
 * A feature that's intentionally disabled during the free trial. Looks like the
 * real control but does nothing — hovering or clicking reveals when it unlocks.
 */
export function LockedFeature({ label, variant = "nav", align = "center" }: Props) {
  const [show, setShow] = useState(false);
  const Trigger = variant === "nav" ? "button" : "span";

  return (
    <span
      className="locked-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Trigger
        type={variant === "nav" ? "button" : undefined}
        className={variant === "inline" ? "locked-inline" : undefined}
        aria-disabled="true"
        onClick={(e) => {
          e.preventDefault();
          setShow((s) => !s);
        }}
      >
        {label}
      </Trigger>
      <span
        role="tooltip"
        className={`locked-tip locked-tip-${align}${show ? " show" : ""}`}
      >
        🔒 {LOCK_MSG}
      </span>
    </span>
  );
}
