import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  experimental: {
    useTypeScriptCli: false,
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "zustand",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "recharts",
    ],
  },

  async rewrites() {
    const backendUrl = process.env.INTERNAL_ADMIN_API_URL || "http://localhost:8081";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
