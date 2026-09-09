import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Monad Validators", template: "%s · Monad Validators" },
  description:
    "Validator and staking explorer for Monad mainnet and testnet: active set, stake, commission, block production, epochs and delegations.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://monad-validators.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
