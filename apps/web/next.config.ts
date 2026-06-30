import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import "./lib/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

function originFromUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function remotePatternFromUrl(value: string | undefined): RemotePattern | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const appOrigin = originFromUrl(process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL);
const r2Origin = originFromUrl(process.env.R2_PUBLIC_URL);
const r2RemotePattern = remotePatternFromUrl(process.env.R2_PUBLIC_URL);
const imageRemotePatterns: RemotePattern[] = r2RemotePattern
  ? [r2RemotePattern]
  : [
      {
        protocol: "https",
        hostname: "**",
      },
    ];
const connectSrc = [
  "'self'",
  "https:",
  "wss:",
  "ws:",
  "https://*.ably.io",
  "wss://*.ably.io",
  appOrigin,
  r2Origin,
]
  .filter(Boolean)
  .join(" ");
const mediaSrc = ["'self'", "blob:", "data:", "https:", r2Origin].filter(Boolean).join(" ");
const imgSrc = ["'self'", "data:", "blob:", "https:", r2Origin].filter(Boolean).join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc}`,
  `media-src ${mediaSrc}`,
  `connect-src ${connectSrc}`,
  "font-src 'self' data:",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageRemotePatterns,
  },
  transpilePackages: ["@repo/types", "@repo/utils"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };

    return config;
  },
};

export default nextConfig;
