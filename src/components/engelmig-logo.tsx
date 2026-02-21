"use client";

import Image from "next/image";

// Símbolo real da Engelmig — raio amarelo com sombra preta/vermelha, fundo transparente
export function EngelmigLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/raio-engelmig.png"
      alt="Engelmig Energia"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}

// Logo completo: símbolo + texto ENGELMIG / ENERGIA
export function EngelmigLogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <EngelmigLogo size={36} />
      <div className="flex flex-col leading-none">
        {/* ENGELMIG — branco, extra-bold, tracking apertado como na marca */}
        <span
          className="text-[15px] font-black text-white"
          style={{ letterSpacing: "-0.02em" }}
        >
          ENGELMIG
        </span>
        {/* ENERGIA — verde, bold, tracking largo como na propaganda */}
        <span
          className="text-[9px] font-bold text-[#22a63e]"
          style={{ letterSpacing: "0.22em" }}
        >
          ENERGIA
        </span>
      </div>
    </div>
  );
}
