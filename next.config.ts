import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Product photography lives in /public/images and is served as-is;
    // no remote image sources are used.
    formats: ["image/webp"],
  },
};

export default withNextIntl(nextConfig);
