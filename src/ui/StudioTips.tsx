import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { tipsForProduct, type StudioTip } from './tipCatalog';

export const FIRST_TIP_DELAY_MS = 3000;
export const TIP_VISIBLE_MS = 12_000;
const QUIET_TIME_MS = 4_000;
const AUTOMATIC_TIPS_DISABLED_KEY = 'studio.automaticTipsDisabled';

function readAutomaticTipsDisabled(): boolean {
  try {
    return localStorage.getItem(AUTOMATIC_TIPS_DISABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export interface StudioTipsHandle {
  showTip: () => void;
}

function LightbulbIcon({ className, active = false }: { className: string; active?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {active && <path d="M12 1v1M3 9H1M23 9h-2M4.2 2.8l1.4 1.4M19.8 2.8l-1.4 1.4" />}
      <path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" />
    </svg>
  );
}

export function TipButton({ onClick, active = false }: { onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label="Show a tip" aria-expanded={active} title={active ? 'Show another tip' : 'Show a tip'} className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 shadow-md backdrop-blur transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:bg-stone-900/90 ${
      active
        ? 'border-orange-300 text-orange-300 hover:border-orange-400 dark:border-orange-300 dark:text-orange-300 dark:hover:border-orange-400'
        : 'border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-stone-100'
    }`}>
      <LightbulbIcon active={active} className={`h-5 w-5 ${active ? 'fill-current drop-shadow-[0_0_4px_var(--color-orange-300)]' : ''}`} />
    </button>
  );
}

/** One automatic hint per editor opening, with more available on request. */
export function StudioTips({ productId, ref, onActiveChange }: { productId: string; ref?: Ref<StudioTipsHandle>; onActiveChange?: (active: boolean) => void }) {
  const showTipRef = useRef<(() => void) | null>(null);
  useImperativeHandle(ref, () => ({ showTip: () => showTipRef.current?.() }), []);
  const messageRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<StudioTip | null>(null);
  const [automatic, setAutomatic] = useState(false);
  const [automaticTipsDisabled, setAutomaticTipsDisabled] = useState(readAutomaticTipsDisabled);
  const automaticTipsDisabledRef = useRef(automaticTipsDisabled);
  const schedule = useRef({ nextAt: 0, expiresAt: 0, visible: false, hoveredAt: null as number | null });

  function changeAutomaticTipsDisabled(disabled: boolean) {
    automaticTipsDisabledRef.current = disabled;
    setAutomaticTipsDisabled(disabled);
    try {
      localStorage.setItem(AUTOMATIC_TIPS_DISABLED_KEY, String(disabled));
    } catch {
      // Keep the preference for this editor even when browser storage is blocked.
    }
  }

  function dismiss() {
    schedule.current.visible = false;
    schedule.current.hoveredAt = null;
    setTip(null);
    onActiveChange?.(false);
  }

  function pauseDismissal() {
    const timing = schedule.current;
    if (timing.visible && timing.hoveredAt === null) timing.hoveredAt = Date.now();
  }

  function resumeDismissal() {
    const timing = schedule.current;
    if (timing.hoveredAt === null) return;
    timing.expiresAt += Date.now() - timing.hoveredAt;
    timing.hoveredAt = null;
  }

  useEffect(() => {
    const available = tipsForProduct(productId);
    const remaining = [...available];
    let lastTipId: string | undefined;
    const pointers = new Set<number>();
    let lastActivity = Date.now() - QUIET_TIME_MS;
    let foreground = true;
    let initialTipPending = !automaticTipsDisabledRef.current;
    const timing = schedule.current;
    timing.nextAt = Date.now() + FIRST_TIP_DELAY_MS;
    timing.visible = false;
    timing.hoveredAt = null;

    function showTip(isAutomatic = false) {
      if (!available.length || !foreground || document.hidden || document.querySelector('dialog[open]')) return;
      initialTipPending = false;
      if (!remaining.length) remaining.push(...available);
      // Cycle through the catalogue and avoid the same hint twice in a row at a cycle boundary.
      const candidates = remaining.filter((candidate) => candidate.id !== lastTipId || remaining.length === 1);
      const next = candidates[Math.floor(Math.random() * candidates.length)]!;
      remaining.splice(remaining.indexOf(next), 1);
      lastTipId = next.id;
      setTip(next);
      setAutomatic(isAutomatic);
      onActiveChange?.(true);
      timing.visible = true;
      timing.expiresAt = Date.now() + TIP_VISIBLE_MS;
      if (timing.hoveredAt !== null) timing.hoveredAt = Date.now();
    }
    showTipRef.current = showTip;

    function activity() { lastActivity = Date.now(); }
    function pointerDown(event: PointerEvent) { pointers.add(event.pointerId); activity(); }
    function pointerUp(event: PointerEvent) { pointers.delete(event.pointerId); activity(); }
    function hide() {
      if (timing.visible) {
        timing.visible = false;
        timing.hoveredAt = null;
        setTip(null);
        onActiveChange?.(false);
      }
    }
    function visibilityChanged() {
      if (document.hidden) {
        initialTipPending = false;
        hide();
        pointers.clear();
      }
    }

    function blurred() {
      foreground = false;
      initialTipPending = false;
      hide();
      pointers.clear();
    }
    function focused() { foreground = true; }

    const timer = window.setInterval(() => {
      const now = Date.now();
      // Returning to the app never schedules an automatic hint.
      if (!foreground || document.hidden) {
        initialTipPending = false;
        hide();
        return;
      }
      if (document.querySelector('dialog[open]')) {
        hide();
        timing.nextAt = Math.max(timing.nextAt, now + FIRST_TIP_DELAY_MS);
        return;
      }
      if (timing.visible) {
        if (timing.hoveredAt !== null || messageRef.current?.contains(document.activeElement)) return;
        if (now >= timing.expiresAt) {
          hide();
        }
        return;
      }
      if (!initialTipPending || automaticTipsDisabledRef.current || now < timing.nextAt || pointers.size || now - lastActivity < QUIET_TIME_MS) return;
      showTip(true);
    }, 1000);

    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('pointerup', pointerUp, true);
    document.addEventListener('pointercancel', pointerUp, true);
    document.addEventListener('keydown', activity, true);
    document.addEventListener('input', activity, true);
    document.addEventListener('wheel', activity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('blur', blurred);
    window.addEventListener('focus', focused);
    return () => {
      showTipRef.current = null;
      onActiveChange?.(false);
      window.clearInterval(timer);
      document.removeEventListener('pointerdown', pointerDown, true);
      document.removeEventListener('pointerup', pointerUp, true);
      document.removeEventListener('pointercancel', pointerUp, true);
      document.removeEventListener('keydown', activity, true);
      document.removeEventListener('input', activity, true);
      document.removeEventListener('wheel', activity, true);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('blur', blurred);
      window.removeEventListener('focus', focused);
    };
  }, [productId, onActiveChange]);

  // Keep the live region mounted so screen readers receive each hint politely.
  return (
    <div ref={messageRef} className="pointer-events-none min-w-0 w-full max-w-sm">
      <div role="status" aria-live="polite" aria-atomic="true">
        {tip && (
          <div onMouseEnter={pauseDismissal} onMouseLeave={resumeDismissal} className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-stone-200/80 bg-white/90 px-3 py-2.5 text-stone-600 shadow-sm backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/90 dark:text-stone-300">
            <LightbulbIcon className="mt-0.5 h-4 w-4 shrink-0 text-orange-500 dark:text-orange-300" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-stone-800 dark:text-stone-200">Did you know?</p>
              <p className="mt-0.5 text-xs leading-relaxed">{tip.message}</p>
              {automatic && (
                <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={automaticTipsDisabled} onChange={(event) => changeAutomaticTipsDisabled(event.target.checked)} className="h-3.5 w-3.5 accent-orange-300" />
                  Disable automatic tips
                </label>
              )}
            </div>
            <button type="button" onClick={dismiss} aria-label="Dismiss tip" title="Dismiss this tip" className="pointer-events-auto -mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
