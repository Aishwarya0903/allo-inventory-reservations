import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory Reservations",
  description:
    "Concurrency-safe inventory holds for multi-warehouse checkout operations.",
};

const themeInitializationScript = `
  (() => {
    const storageKey = "allo-theme";
    const root = document.documentElement;

    try {
      const storedTheme = window.localStorage.getItem(storageKey);
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      const theme = storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : systemTheme;

      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    } catch {
      root.dataset.theme = "light";
      root.style.colorScheme = "light";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
        {children}
      </body>
    </html>
  );
}
