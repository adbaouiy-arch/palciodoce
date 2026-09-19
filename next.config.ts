import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Product photography lives in /public/images and is served as-is;
    // no remote image sources are used.
    formats: ["image/webp"],
  },

  /*
    Keep the Firebase Admin SDK out of the server bundle.

    It reaches Firestore over gRPC, which loads its schema from ~150 `.proto`
    files and a couple of dozen generated protobuf JSON bundles, resolved by
    runtime `require()` calls built from strings. A bundler cannot see those, so
    the files are left behind and the SDK throws the moment it initialises.

    The failure is specific and misleading. Bundling only affects the deployed
    function, so a local `next build && next start` works — it has the whole of
    `node_modules` to hand. Prerendered pages also keep working, because their
    HTML was produced during the build, in that same complete environment. What
    breaks is every route rendered on demand, which looks like a credentials or
    networking problem and is neither.

    Listing it here makes Next.js require it from `node_modules` at runtime
    instead. The proto-carrying dependencies are named explicitly rather than
    left to cascade, because each one is separately capable of being flattened
    into the bundle.
  */
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "google-gax",
    "@grpc/grpc-js",
    "protobufjs",
  ],
};

export default withNextIntl(nextConfig);
