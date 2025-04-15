import { useCallback, useRef, useState, MouseEvent, TouchEvent } from "react";

type Options = {
  shouldPreventDefault?: boolean;
  delay?: number;
};

const useLongPress = (
  onLongPress: (e: MouseEvent | TouchEvent) => void,
  onClick: (e: MouseEvent | TouchEvent) => void,
  { shouldPreventDefault = true, delay = 300 }: Options = {},
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const target = useRef<EventTarget | null>(null);

  const start = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (shouldPreventDefault && event.target) {
        (event.target as HTMLElement).addEventListener(
          "touchend",
          preventDefault as unknown as EventListener,
          {
            passive: false,
          },
        );
        target.current = event.target;
      }
      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault],
  );

  const clear = useCallback(
    (event: MouseEvent | TouchEvent, shouldTriggerClick = true) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      if (shouldTriggerClick && !longPressTriggered) {
        onClick(event);
      }
      setLongPressTriggered(false);
      if (shouldPreventDefault && target.current) {
        (target.current as HTMLElement).removeEventListener(
          "touchend",
          preventDefault as unknown as EventListener,
        );
      }
    },
    [shouldPreventDefault, onClick, longPressTriggered],
  );

  return {
    onMouseDown: (e: MouseEvent) => start(e),
    onTouchStart: (e: TouchEvent) => start(e),
    onMouseUp: (e: MouseEvent) => clear(e),
    onMouseLeave: (e: MouseEvent) => clear(e, false),
    onTouchEnd: (e: TouchEvent) => clear(e),
  };
};

const isTouchEvent = (event: TouchEvent | MouseEvent): event is TouchEvent => {
  return (event as TouchEvent).touches !== undefined;
};

const preventDefault = (event: TouchEvent | MouseEvent) => {
  if (!isTouchEvent(event)) return;

  if (event.touches.length < 2 && event.preventDefault) {
    event.preventDefault();
  }
};

export default useLongPress;
