import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt="Translater Sir"
      width={size}
      height={size}
      priority={size >= 48}
      className={className}
    />
  );
}
