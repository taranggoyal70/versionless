import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://versionless-navy.vercel.app"),
  title: "Versionless - Proof for every agent-written change",
  description: "Let coding agents change your code. Versionless proves they did not change the rules.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Versionless",
    title: "Versionless - Proof for every agent-written change",
    description: "Let coding agents change your code. Make them prove they did not change the rules.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Versionless - Proof for every agent-written change",
    description: "Let coding agents change your code. Make them prove they did not change the rules.",
    images: [{ url: "/opengraph-image", alt: "Versionless verification proof for agent-written code" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
