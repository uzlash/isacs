import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ClientRoot from "@/components/ClientRoot";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ISACS — Nigerian Air Force",
  description: "Integrated Security Access Control System · Operator Console",
};

// Sets theme/density/accent from localStorage before first paint (no flash).
const themeScript = `(function(){try{var t=localStorage.getItem("isacs-theme")||"obsidian";document.documentElement.setAttribute("data-theme",t);var d=localStorage.getItem("isacs-density")||"balanced";document.documentElement.setAttribute("data-density",d);var a=localStorage.getItem("isacs-accent");if(a)document.documentElement.style.setProperty("--accent",a);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="obsidian"
      data-density="balanced"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
