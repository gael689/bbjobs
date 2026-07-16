"use client";

interface ProfileCompletionRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function colorForCompletion(percent: number): string {
  if (percent >= 100) return "#16A34A";
  if (percent >= 70) return "#1E8EA3";
  if (percent >= 40) return "#F59E0B";
  return "#EF4444";
}

/** Anillo circular de % de perfil completo — mismo cálculo para candidato y empresa
 * (backend expone un único `completion_percent`), sólo cambia dónde se renderiza. */
export default function ProfileCompletionRing({
  percent, size = 96, strokeWidth = 8, label, className = "",
}: ProfileCompletionRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = colorForCompletion(clamped);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EEF2F7" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-[#1C2230] leading-none" style={{ fontSize: size * 0.22 }}>
          {clamped}%
        </span>
        {label && <span className="text-[10px] text-[#64748B] mt-0.5 text-center leading-tight">{label}</span>}
      </div>
    </div>
  );
}
