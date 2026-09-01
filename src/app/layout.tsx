import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}