import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory Reservations",
  description: "Checkout reservation foundation for multi-warehouse inventory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
