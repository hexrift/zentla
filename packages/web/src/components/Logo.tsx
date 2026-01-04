interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: { icon: "w-7 h-7", text: "text-base" },
  md: { icon: "w-8 h-8", text: "text-lg" },
  lg: { icon: "w-10 h-10", text: "text-xl" },
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${s.icon} rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center relative`}
      >
        {/* Stylized Z as connected path */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="w-full h-full"
          aria-hidden="true"
        >
          <path
            d="M8 10h16l-12 12h16"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Accent dot */}
          <circle cx="24" cy="10" r="2" fill="#fbbf24" />
        </svg>
      </div>
      {showText && (
        <span className={`${s.text} font-semibold text-gray-900`}>Zentla</span>
      )}
    </div>
  );
}
