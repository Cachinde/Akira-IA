import Image from "next/image";

export default function Logo({ size = 72 }: { size?: number }) {
  return (
    <span className="logo-crop" style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
      <img
        src="/akira-logo.svg"
        alt=""
        width={size}
        height={size}
        style={{ width: "100%", height: "auto", filter: "drop-shadow(0 0 6px rgba(0,0,0,0.4))" }}
        priority={size > 60}
      />
    </span>
  );
}
