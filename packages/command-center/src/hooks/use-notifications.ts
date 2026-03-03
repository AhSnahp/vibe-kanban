import { useEffect, useRef } from 'react';
import { useWorkspaceStore, type LoopState } from '@cc/stores/workspace-store';

/**
 * Fires browser notifications when workspace agents complete or fail,
 * but only when the tab is not focused.
 */
export function useNotifications() {
  const runtimes = useWorkspaceStore((s) => s.runtimes);
  const prevStatesRef = useRef<Record<string, LoopState>>({});
  const permissionRef = useRef<NotificationPermission>('default');

  // Request permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    } else if ('Notification' in window) {
      permissionRef.current = Notification.permission;
    }
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (document.hasFocus()) {
      // Update prev states silently when focused
      const next: Record<string, LoopState> = {};
      for (const [id, rt] of Object.entries(runtimes)) {
        next[id] = rt.loopState;
      }
      prevStatesRef.current = next;
      return;
    }

    for (const [id, rt] of Object.entries(runtimes)) {
      const prev = prevStatesRef.current[id];
      if (prev && prev !== rt.loopState) {
        if (rt.loopState === 'done') {
          notify('Agent Complete', `Workspace ${id.slice(0, 8)} finished.`);
        } else if (rt.loopState === 'failed') {
          notify('Agent Failed', `Workspace ${id.slice(0, 8)} failed.`);
        } else if (rt.loopState === 'paused') {
          notify(
            'Agent Paused',
            `Workspace ${id.slice(0, 8)} is waiting for review.`
          );
        }
      }
    }

    // Update prev states
    const next: Record<string, LoopState> = {};
    for (const [id, rt] of Object.entries(runtimes)) {
      next[id] = rt.loopState;
    }
    prevStatesRef.current = next;
  }, [runtimes]);
}

function notify(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}
