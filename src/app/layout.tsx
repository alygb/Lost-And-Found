import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import BanChecker from "@/components/layouts/BanChecker";

export const metadata: Metadata = {
  title: "Lost & Found System",
  description: "University Lost and Found Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <BanChecker />
        <main>{children}</main>
      </body>
    </html>
  );
}