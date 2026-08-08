import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

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
};

export default nextConfig;
