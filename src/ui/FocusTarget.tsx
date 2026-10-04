import type { ReactNode } from 'react';
import { useFocusTarget } from './panelStore';

interface FocusTargetProps {
  /** What the preview asks for to reveal this. Undefined for a control with nothing pointing at it. */
  focusKey?: string;
  /** Layout classes for the wrapper, so this can replace a section's own container rather than adding one. */
  className?: string;
  children: ReactNode;
}

/**
 * Wraps the control that edits a particular part of the design, so clicking
 * that part in the preview brings you here.
 *
 * It washes over rather than outlining: a border would read as a state the
 * control is now in, and nothing here is selected — the preview is still the
 * thing being edited. The wash itself is `focus-flash` in index.css; any room
 * it needs around a bare control comes from the caller's own classes, since a
 * section that already has a box of its own wants the wash to fill that box
 * rather than a wider one.
 */
export function FocusTarget({ focusKey, className = '', children }: FocusTargetProps) {
  const ref = useFocusTarget(focusKey);
  return (
    <div ref={ref} className={`rounded-lg ${className}`}>
      {children}
    </div>
  );
}
