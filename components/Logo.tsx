import Image from "next/image";

export default function Logo({ size = 72 }: { size?: number }) {
  return (
    <span className="logo-crop" style={{ width: size, height: size }} aria-hidden="true">
      <Image
        className="logo-image"
        src="/akira-logo.png"
        alt=""
        width={Math.round(size * 2.6)}
        height={Math.round(size * 2.6)}
        priority={size > 60}
        style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.4))" } as React.CSSProperties}
      />
    </span>
  );
}
