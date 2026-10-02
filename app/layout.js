import "./globals.css";

export const metadata = {
  title: "簡単仕訳屋さん",
  description: "通帳・レシート・明細から仕訳を作り、会計ソフトの取込形式で書き出すWebシステム",
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2E6A4E" };

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
