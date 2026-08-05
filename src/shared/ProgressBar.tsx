import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Image, FileText, Globe, Newspaper, Zap } from "lucide-react";

export type TaskType = "search" | "generate" | "write" | "web" | "news" | "general";

export interface ProgressTaskState {
  active: boolean;
  label: string;
  type: TaskType;
}

const TASK_CONFIG: Record<
  TaskType,
  { Icon: React.FC<any>; color: string; rgb: string; steps: string[] }
> = {
  search: {
    Icon: Search,
    color: "#00d4ff",
    rgb: "0, 212, 255",
    steps: [
      "Scanning Desktop…",
      "Scanning Documents…",
      "Scanning Downloads…",
      "Checking all drives…",
      "Finalizing results…",
    ],
  },
  generate: {
    Icon: Image,
    color: "#a855f7",
    rgb: "168, 85, 247",
    steps: [
      "Initializing model…",
      "Generating pixels…",
      "Refining details…",
      "Finalizing image…",
    ],
  },
  write: {
    Icon: FileText,
    color: "#22c55e",
    rgb: "34, 197, 94",
    steps: [
      "Opening application…",
      "Preparing content…",
      "Writing document…",
      "Formatting text…",
    ],
  },
  web: {
    Icon: Globe,
    color: "#f97316",
    rgb: "249, 115, 22",
    steps: ["Connecting…", "Fetching results…", "Analyzing data…"],
  },
  news: {
    Icon: Newspaper,
    color: "#eab308",
    rgb: "234, 179, 8",
    steps: ["Fetching latest news…", "Scanning sources…", "Compiling summary…"],
  },
  general: {
    Icon: Zap,
    color: "#ffffff",
    rgb: "255, 255, 255",
    steps: ["Processing…", "Working on it…"],
  },
};

interface ProgressBarProps {
  task: ProgressTaskState | null;
}

export default React.memo(function ProgressBar({ task }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  // Slowly advance a fake progress bar up to ~92%, then freeze until done
  useEffect(() => {
    if (!task?.active) {
      setProgress(0);
      setStepIndex(0);
      return;
    }

    setProgress(0);
    setStepIndex(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return 92;
        return prev + Math.random() * 1.8 + 0.4;
      });
    }, 700);

    const config = TASK_CONFIG[task.type];
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % config.steps.length);
    }, 2200);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [task?.active, task?.type]);

  const config = TASK_CONFIG[task?.type ?? "general"];
  const { Icon } = config;
  const currentStep = config.steps[stepIndex % config.steps.length];

  return (
    <AnimatePresence>
      {task?.active && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.94 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="fixed bottom-20 left-1/2 z-30"
          style={{ translateX: "-50%" }}
        >
          <div
            className="rounded-2xl border backdrop-blur-2xl overflow-hidden"
            style={{
              width: "min(360px, 90vw)",
              background: `rgba(${config.rgb}, 0.06)`,
              borderColor: `rgba(${config.rgb}, 0.22)`,
              boxShadow: `0 0 28px rgba(${config.rgb}, 0.1), 0 8px 32px rgba(0,0,0,0.45)`,
            }}
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
              {/* Icon */}
              <motion.div
                animate={{ opacity: [0.65, 1, 0.65] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `rgba(${config.rgb}, 0.14)` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
              </motion.div>

              {/* Label + step */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[11px] font-mono uppercase tracking-[0.18em] truncate leading-tight"
                  style={{ color: config.color }}
                >
                  {task?.label}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.25 }}
                    className="text-[9px] text-white/30 font-mono mt-0.5 truncate"
                  >
                    {currentStep}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Pulsing dots */}
              <div className="flex gap-1 flex-shrink-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.22 }}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: config.color }}
                  />
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-3.5">
              <div
                className="w-full h-[3px] rounded-full overflow-hidden"
                style={{ background: `rgba(${config.rgb}, 0.1)` }}
              >
                <motion.div
                  className="h-full rounded-full relative overflow-hidden"
                  style={{
                    background: `linear-gradient(90deg, rgba(${config.rgb},0.5), ${config.color})`,
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.75, ease: "easeOut" }}
                >
                  {/* Shimmer sweep */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    style={{ transform: "skewX(-12deg)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              </div>

              {/* Percentage */}
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] font-mono text-white/20">Friday is working…</span>
                <span
                  className="text-[9px] font-mono"
                  style={{ color: `rgba(${config.rgb}, 0.55)` }}
                >
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
