import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 上岗实战总教练",
  description: "AI 应用开发与智能体工程实战训练营 · 教练智能体",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
