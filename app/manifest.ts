import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "dizzywave - the sound of your imagination",
    short_name: "dizzywave",
    description: "A freehand canvas where geometry becomes sound.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0e12",
    theme_color: "#f6ab3e",
    icons: [
      {
        src: "/logo.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon",
      },
      {
        src: "/logo.ico",
        sizes: "192x192",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: "/logo.ico",
        sizes: "512x512",
        type: "image/x-icon",
        purpose: "maskable",
      },
    ],
  };
}
