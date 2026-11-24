import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VocabPro",
    short_name: "VocabPro",
    description: "Maktab uchun lug‘at mashqlari va testlar",
    lang: "uz",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7fd",
    theme_color: "#f8f7fd",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
