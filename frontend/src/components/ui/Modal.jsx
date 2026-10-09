import { X } from "lucide-react";

export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(20,48,31,.25)", backdropFilter: "blur(4px)", zIndex: 50 }} onClick={onClose}>
      {/* Keep the entrance animation separate so hover/click cannot restart it. */}
      <div className="pop w-full" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div data-liquid className="glass liquid-key w-full" style={{ padding: "1.6rem" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-bold">{title}</div>
            <button onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
