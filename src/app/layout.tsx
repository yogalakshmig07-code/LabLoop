import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabLoop | Campus Resource-Sharing Platform",
  description:
    "Safely share university laboratory equipment, maker spaces, computing clusters, and specialized gear between faculty owners and students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

