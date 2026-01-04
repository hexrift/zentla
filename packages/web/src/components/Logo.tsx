interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  animate?: boolean;
}

const sizes = {
  sm: { icon: "w-7 h-7", text: "text-base" },
  md: { icon: "w-8 h-8", text: "text-lg" },
  lg: { icon: "w-10 h-10", text: "text-xl" },
};

export function Logo({
  size = "md",
  showText = true,
  animate = false,
}: LogoProps) {
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${s.icon} rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center relative overflow-hidden`}
      >
        {/* Concept 5: Clean Z with control accent */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Clean Z */}
          <path
            d="M7 8h18L7 24h18"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Control indicator dot at top-right */}
          <circle
            cx="25"
            cy="8"
            r="2.5"
            fill="#fbbf24"
            className={animate ? "animate-pulse" : ""}
          />
        </svg>
      </div>
      {showText && (
        <span className={`${s.text} font-semibold text-gray-900`}>Zentla</span>
      )}
    </div>
  );
}
