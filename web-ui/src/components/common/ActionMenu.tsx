import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import { cn } from '@/utils/cn';

interface ActionMenuProps {
  label: string;
  items: { label: string; onClick: () => void; className?: string }[];
}

export default function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const close = useCallback((restoreFocus = true) => {
    // Restore before the action callback so a new modal captures the persistent opener.
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popupRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const popup = popupRef.current.getBoundingClientRect();
    const below = trigger.bottom + 4;
    setPosition({
      left: Math.max(8, Math.min(trigger.right - popup.width, window.innerWidth - popup.width - 8)),
      top: Math.max(8, Math.min(
        below + popup.height <= window.innerHeight - 8 ? below : trigger.top - popup.height - 4,
        window.innerHeight - popup.height - 8,
      )),
    });
    popupRef.current.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node
        && !triggerRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !popupRef.current?.contains(event.target)) close();
    };
    const onResize = () => close();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  return <>
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? popupId : undefined}
      onBlur={(event) => {
        if (!popupRef.current?.contains(event.relatedTarget)) close(false);
      }}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((value) => !value);
      }}
    >
      <span aria-hidden="true">⋯</span>
    </Button>
    {open && createPortal(<div
      ref={popupRef}
      id={popupId}
      role="group"
      aria-label={label}
      style={position}
      className="fixed z-50 min-w-[10rem] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-md"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (event.relatedTarget !== triggerRef.current && !event.currentTarget.contains(event.relatedTarget)) close(false);
      }}
    >
      {items.map((item) => <button
        key={item.label}
        type="button"
        className={cn('w-full rounded px-3 py-1.5 text-left text-sm hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', item.className)}
        onClick={() => {
          close();
          item.onClick();
        }}
      >{item.label}</button>)}
    </div>, document.body)}
  </>;
}
