import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import type { Toast as ToastType } from "../lib/useToast";

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    icon: "text-emerald-400",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    bar: "bg-emerald-400",
  },
  error: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    icon: "text-red-400",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    bar: "bg-red-400",
  },
  info: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    icon: "text-cyan-400",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    bar: "bg-cyan-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    icon: "text-amber-400",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    bar: "bg-amber-400",
  },
};

interface ToastContainerProps {
  toasts: ToastType[];
  removeToast: (id: string) => void;
}

export default React.memo(function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          const colors = colorMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-auto relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl border backdrop-blur-xl ${colors.border} ${colors.bg} ${colors.glow} min-w-[280px] max-w-[400px]`}
            >
              {/* Accent bar */}
              <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${colors.bar}`} />

              <Icon className={`w-5 h-5 flex-shrink-0 ${colors.icon}`} />
              <span className="text-sm text-white/90 font-medium flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>

              {/* Auto-dismiss progress bar */}
              {toast.duration && toast.duration > 0 && (
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: toast.duration / 1000, ease: "linear" }}
                  className={`absolute bottom-0 left-2 right-2 h-[2px] rounded-full origin-left ${colors.bar} opacity-40`}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

