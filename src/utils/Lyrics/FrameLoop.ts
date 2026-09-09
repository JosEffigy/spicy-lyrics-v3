// One cancellable frame at a time; scheduling is independent of player state
// so paused animations can settle and seeking still updates immediately.
export function createFrameLoop(tick: () => void,
  request: (callback: FrameRequestCallback) => number,
  cancel: (id: number) => void) {
  let pending: number | undefined;
  let active = false;
  let disposed = false;
  const frame = () => {
    pending = undefined;
    if (!active || disposed) return;
    try { tick(); }
    finally {
      if (active && !disposed) pending = request(frame);
    }
  };
  return {
    setActive(value: boolean) {
      if (disposed || active === value) return;
      active = value;
      if (pending !== undefined) cancel(pending);
      pending = active ? request(frame) : undefined;
    },
    dispose() {
      disposed = true;
      active = false;
      if (pending !== undefined) cancel(pending);
      pending = undefined;
    },
  };
}
