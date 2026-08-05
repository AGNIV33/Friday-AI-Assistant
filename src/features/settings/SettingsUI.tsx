import React from "react";
import { motion } from "motion/react";

// ─── Animation Variants ──────────────────────────────────────────────────────

export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 350, damping: 25 } },
};

/**
 * On/off switch. The settings panel had no toggle primitive — every existing
 * boolean-ish control is a selected/unselected button row — so this is the
 * first one. Uses the same accent-glow language as AccentSlider.
 */
export function Toggle({ checked, onChange, label, description, accentColor, accentRgb, disabled = false }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  accentColor: string;
  accentRgb: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-2.5 ${disabled ? 'opacity-40' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-white/80 font-medium">{label}</div>
        {description && (
          <div className="text-[11px] text-white/30 mt-0.5 leading-snug">{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-[42px] h-[24px] rounded-full flex-shrink-0 transition-colors duration-200"
        style={{
          background: checked ? `rgba(${accentRgb}, 0.28)` : 'rgba(255,255,255,0.06)',
          border: `1px solid ${checked ? `rgba(${accentRgb}, 0.5)` : 'rgba(255,255,255,0.08)'}`,
          boxShadow: checked ? `0 0 12px rgba(${accentRgb}, 0.18)` : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <motion.div
          className="absolute top-[2px] w-[18px] h-[18px] rounded-full"
          animate={{ left: checked ? 21 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          style={{
            background: checked ? accentColor : 'rgba(255,255,255,0.35)',
            boxShadow: checked ? `0 0 8px ${accentColor}` : 'none',
          }}
        />
      </button>
    </div>
  );
}

export function SectionTitle({ title, accentColor }: { title: string; accentColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {accentColor && (
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
        />
      )}
      <h3 className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold">{title}</h3>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

export function GlassCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function GradientSwatch({ colors, size = 24 }: { colors: string[]; size?: number }) {
  const gradientStr = `conic-gradient(${colors.join(', ')}, ${colors[0]})`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full gradient-swatch-ring"
        style={{ background: gradientStr, opacity: 0.5, filter: 'blur(3px)' }}
      />
      <div
        className="absolute inset-[2px] rounded-full gradient-swatch"
        style={{
          background: `linear-gradient(135deg, ${colors.join(', ')}, ${colors[0]})`,
          boxShadow: `0 0 12px rgba(${colors[0]}, 0.3)`,
        }}
      />
    </div>
  );
}

export function AccentSlider({ value, onChange, min, max, step, accentColor, glowColor, label, displayValue }: {
  value: number;
  onChange: (v: number) => void;
  min: string;
  max: string;
  step: string;
  accentColor: string;
  glowColor: string;
  label?: React.ReactNode;
  displayValue: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 settings-slider"
        style={{
          '--slider-color': accentColor,
          '--slider-glow': glowColor,
        } as React.CSSProperties}
      />
      <span className="text-[11px] text-white/35 font-mono w-10 text-right">{displayValue}</span>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <span className="text-xs text-white/35">{label}</span>
      <span className="text-xs text-white/60 font-mono">{value}</span>
    </div>
  );
}

export function AccentButton({ onClick, children, accentRgb, accent, className = "" }: {
  onClick: () => void;
  children: React.ReactNode;
  accentRgb: string;
  accent: string;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${className}`}
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb}, 0.15), rgba(${accentRgb}, 0.08))`,
        border: `1px solid rgba(${accentRgb}, 0.2)`,
        color: accent,
        boxShadow: `0 0 20px rgba(${accentRgb}, 0.06)`,
      }}
    >
      {children}
    </motion.button>
  );
}
