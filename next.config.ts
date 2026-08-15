import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@prisma/client` and `prisma` are already on Next's built-in externals list;
  // the pg driver and its Prisma adapter are not, and they need native Node
  // `require` rather than being bundled into the server build.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
