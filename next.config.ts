import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server otherwise blocks JS asset requests from any origin other
  // than "localhost", which breaks hydration (all click handlers silently
  // no-op) when the app is opened via 127.0.0.1 or a LAN IP.
  allowedDevOrigins: ["127.0.0.1", "192.168.0.100", "192.168.0.189"],
};

export default nextConfig;
