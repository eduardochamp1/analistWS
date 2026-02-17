"use client";

import { useId } from "react";

export function EngelmigLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Engelmig Energia"
    >
      <path
        d="M55 8L25 50H45L35 92L75 42H52L65 8H55Z"
        fill={`url(#${gradientId})`}
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke="#1b7a2b"
        strokeWidth="3"
        fill="none"
      />
      <defs>
        <linearGradient id={gradientId} x1="35" y1="8" x2="55" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8B800" />
          <stop offset="50%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function EngelmigLogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <EngelmigLogo size={32} />
      <div className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight text-white">
          ENGELMIG
        </span>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#1b7a2b]">
          ENERGIA
        </span>
      </div>
    </div>
  );
}
