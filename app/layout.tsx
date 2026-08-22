import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dizzywave.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "dizzywave - sound of your imagination",
    template: "%s | dizzywave",
  },
  description:
    "Turn your drawings into sound and music in real time. Dizzywave is a freehand visual sound canvas where geometry becomes polyphonic synth music, bell tones, arcade effects, and ambient soundscapes. Draw to sound, sketch to music, and create interactive audio patterns directly in your browser.",
  keywords: [
    "draw to sound",
    "sketch to sound",
    "sketch to music",
    "make music from sound",
    "draw music online",
    "visual synthesizer",
    "geometry into music",
    "dizzywave",
    "interactive web audio",
    "drawing synthesizer",
    "canvas music generator",
    "sound geometry",
    "sound of your imagination",
    "freehand music canvas",
  ],
  authors: [{ name: "Rajan", url: "https://github.com/rajank18" }],
  creator: "Rajan",
  publisher: "dizzywave",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "dizzywave - sound of your imagination",
    description:
      "Turn your drawings into sound and music in real time. Draw to sound, sketch to music, and transform geometry into polyphonic synth music.",
    url: siteUrl,
    siteName: "dizzywave",
    images: [
      {
        url: "/logo.ico",
        width: 512,
        height: 512,
        alt: "dizzywave - sound of your imagination",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "dizzywave - sound of your imagination",
    description:
      "Turn your drawings into sound and music in real time. Draw to sound, sketch to music, and transform geometry into polyphonic synth music.",
    images: ["/logo.ico"],
  },
  icons: {
    icon: "/logo.ico",
    shortcut: "/logo.ico",
    apple: "/logo.ico",
  },
  category: "technology",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "dizzywave",
  alternateName: "dizzywave - sound of your imagination",
  url: siteUrl,
  description:
    "Turn your drawings into sound and music in real time. Dizzywave is a freehand visual sound canvas where geometry becomes polyphonic synth music.",
  applicationCategory: "MultimediaApplication",
  genre: "Music, Synthesizer, Audio Visualizer",
  operatingSystem: "All",
  browserRequirements: "Requires HTML5 Canvas and Web Audio API support",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: "Rajan",
    url: "https://github.com/rajank18",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="497eab04-f60c-4b3b-ac4a-b3abab82cdaf"
        />
        {children}
      </body>
    </html>
  );
}
