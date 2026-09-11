export interface DraggableFabPosition {
  top: number;
  left: number;
}

const STORAGE_PREFIX = 'denario.draggableFab.';

export function loadDraggableFabPosition(id: string): DraggableFabPosition | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as DraggableFabPosition;
    if (typeof parsed.top === 'number' && typeof parsed.left === 'number') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function saveDraggableFabPosition(id: string, position: DraggableFabPosition): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(position));
  } catch {
    // Ignorar cuotas o modo privado.
  }
}
