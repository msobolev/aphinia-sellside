import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aphinia Sellside",
  description: "Vendor CRM for Aphinia CISO events",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
