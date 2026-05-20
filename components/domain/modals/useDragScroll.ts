import { useRef, type MouseEvent, type PointerEvent } from "react";

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const stateRef = useRef({ down: false, startX: 0, startScroll: 0, dragged: false, pointerId: 0 });

  const onPointerDown = (event: PointerEvent<T>) => {
    if (event.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    stateRef.current = {
      down: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      dragged: false,
      pointerId: event.pointerId
    };
  };

  const onPointerMove = (event: PointerEvent<T>) => {
    const state = stateRef.current;
    const el = ref.current;
    if (!state.down || !el) return;
    const dx = event.clientX - state.startX;
    if (!state.dragged && Math.abs(dx) > 4) {
      state.dragged = true;
      el.style.cursor = "grabbing";
      try {
        el.setPointerCapture(state.pointerId);
      } catch {}
    }
    if (state.dragged) {
      el.scrollLeft = state.startScroll - dx;
    }
  };

  const endDrag = () => {
    const state = stateRef.current;
    const el = ref.current;
    if (el && state.dragged) {
      el.style.cursor = "";
      try {
        el.releasePointerCapture(state.pointerId);
      } catch {}
    }
    state.down = false;
  };

  const onClickCapture = (event: MouseEvent<T>) => {
    if (stateRef.current.dragged) {
      event.preventDefault();
      event.stopPropagation();
      stateRef.current.dragged = false;
    }
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerLeave: endDrag, onPointerCancel: endDrag, onClickCapture };
}
