/**
 * useBackdropDismiss — guards backdrop dismissal against react-modal #466.
 *
 * Problem: when the user presses a pointer device INSIDE the dialog and
 * releases it over the backdrop, the browser fires a click whose target is
 * the backdrop div.  A plain onClick={onClose} fires, closing the modal
 * unintentionally.
 *
 * Fix: track whether the pointer-down started ON the backdrop itself
 * (target === currentTarget).  Only call onClose() when the click also
 * happens on the backdrop AND the earlier down started there too.
 */
import { useRef, useCallback } from "react";
import type React from "react";

interface BackdropProps {
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onMouseDown: React.MouseEventHandler<HTMLDivElement>;
  onClick: React.MouseEventHandler<HTMLDivElement>;
}

export function useBackdropDismiss(onClose: () => void): BackdropProps {
  const downOnBackdrop = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      downOnBackdrop.current = e.target === e.currentTarget;
    },
    [],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      downOnBackdrop.current = e.target === e.currentTarget;
    },
    [],
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && downOnBackdrop.current) {
        onClose();
      }
    },
    [onClose],
  );

  return { onPointerDown, onMouseDown, onClick };
}
