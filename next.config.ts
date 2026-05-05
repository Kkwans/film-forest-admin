import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://192.168.5.110:8081/api/:path*",
      },
    ];
  },
};

export default nextConfig;
