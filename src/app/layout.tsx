import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PustakaObat.id — Pustaka Obat Indonesia",
  description: "Informasi obat berbahasa Indonesia dengan sumber yang dapat ditelusuri dan status peninjauan yang transparan.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} antialiased selection:bg-primary/20 selection:text-primary`}>
        <a href="#main-content" className="skip-link">Lewati navigasi</a>
        {children}
      </body>
    </html>
  );
}
