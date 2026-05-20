"use client";

import { X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

type ModalShellProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  closeOnBackdrop?: boolean;
};

export function ModalShell({
  open,
  title,
  onClose,
  children,
  panelClassName,
  backdropClassName,
  closeOnBackdrop = false
}: ModalShellProps) {
  if (!open) {
    return null;
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    onClose();
  };

  return (
    <div
      className={backdropClassName ? `modal-backdrop ${backdropClassName}` : "modal-backdrop"}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <section className={panelClassName ? `modal-panel ${panelClassName}` : "modal-panel"} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={20} />
          </button>
          <strong>{title}</strong>
          <span />
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
