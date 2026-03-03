import type { BrainstormPlanItem } from 'shared/types';

export interface PhaseDefinition {
  name: string;
  taskTitles: string[];
  taskIndices: number[];
}

/**
 * Topological sort of plan items into execution phases based on dependencies.
 *
 * Items with no dependencies → Phase 1
 * Items depending only on Phase 1 items → Phase 2
 * And so on...
 *
 * Items with unresolvable deps (circular or missing) are placed in the last phase.
 */
export function planToPhases(items: BrainstormPlanItem[]): PhaseDefinition[] {
  if (items.length === 0) return [];

  // Build a dependency graph using title matching
  const titleToIndex = new Map<string, number>();
  items.forEach((item, i) => titleToIndex.set(item.title.toLowerCase(), i));

  const deps: Set<number>[] = items.map((item) => {
    const depSet = new Set<number>();
    for (const dep of item.dependencies ?? []) {
      const idx = titleToIndex.get(dep.toLowerCase());
      if (idx !== undefined) {
        depSet.add(idx);
      }
    }
    return depSet;
  });

  const phases: PhaseDefinition[] = [];
  const assigned = new Set<number>();

  while (assigned.size < items.length) {
    // Find all items whose dependencies are fully assigned
    const ready: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (assigned.has(i)) continue;
      const allDepsAssigned = [...deps[i]].every((d) => assigned.has(d));
      if (allDepsAssigned) {
        ready.push(i);
      }
    }

    // If no items are ready, we have a cycle — dump remaining into last phase
    if (ready.length === 0) {
      const remaining: number[] = [];
      for (let i = 0; i < items.length; i++) {
        if (!assigned.has(i)) remaining.push(i);
      }
      phases.push({
        name: `Phase ${phases.length + 1}`,
        taskTitles: remaining.map((i) => items[i].title),
        taskIndices: remaining,
      });
      break;
    }

    phases.push({
      name: `Phase ${phases.length + 1}`,
      taskTitles: ready.map((i) => items[i].title),
      taskIndices: ready,
    });

    for (const i of ready) {
      assigned.add(i);
    }
  }

  return phases;
}
