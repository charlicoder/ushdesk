'use client';

import { useEffect } from 'react';

/**
 * Locks the page (background) scroll while any modal / popup overlay is open.
 *
 * Popups in this app are rendered as fixed full-screen overlays (`fixed inset-0 z-50+`),
 * so instead of touching every modal this component watches the DOM and toggles the lock
 * automatically. Click-away backdrops for dropdowns (z-40 and below) are ignored.
 */

const MODAL_SELECTOR = [
  '.fixed.inset-0',
  'dialog[open]',
  '[role="dialog"][aria-modal="true"]',
].join(',');

function zIndexFromClass(el: Element): number {
  const m = /(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/.exec(el.getAttribute('class') || '');
  if (!m) return 0;
  return Number(m[1] ?? m[2] ?? 0);
}

function hasOpenModal(): boolean {
  const nodes = document.querySelectorAll(MODAL_SELECTOR);
  for (const el of Array.from(nodes)) {
    if (el.getClientRects().length === 0) continue;
    if (el.matches('dialog[open], [role="dialog"][aria-modal="true"]')) return true;
    if (zIndexFromClass(el) >= 50) return true;
  }
  return false;
}

export function ScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    let locked = false;
    let prev = { htmlOverflow: '', bodyPaddingRight: '' };
    let frame = 0;

    const lock = () => {
      if (locked) return;
      locked = true;
      const scrollbarWidth = window.innerWidth - html.clientWidth;
      prev = { htmlOverflow: html.style.overflow, bodyPaddingRight: body.style.paddingRight };
      html.style.overflow = 'hidden';
      // Avoid layout shift when the scrollbar disappears.
      if (scrollbarWidth > 0) {
        const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + scrollbarWidth}px`;
      }
    };

    const unlock = () => {
      if (!locked) return;
      locked = false;
      html.style.overflow = prev.htmlOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
    };

    const sync = () => {
      frame = 0;
      if (hasOpenModal()) lock();
      else unlock();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'open', 'style'],
    });
    sync();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      unlock();
    };
  }, []);

  return null;
}
