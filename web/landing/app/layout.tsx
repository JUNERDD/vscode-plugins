import type { Metadata } from "next";
import React, { type ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "ZProject VS Code Plugins",
  description:
    "A focused landing page for the ZProject VS Code plugin monorepo, built with Next.js App Router.",
  openGraph: {
    title: "ZProject VS Code Plugins",
    description:
      "Ship VS Code extensions from a Turborepo workspace with Oxc quality gates and Rolldown package builds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
