import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import NextAuthProvider from "@/components/NextAuthProvider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plataforma de Crescimento AI",
  description: "Impulsione o crescimento do seu negócio com análises inteligentes e dados reais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${poppins.className} ${poppins.variable} antialiased min-h-screen relative`}
      >
        {/* Global Background Layer - Subtle SaaS Off-white */}
        <div className="fixed inset-0 z-0 pointer-events-none transition-colors duration-500" />

        <div className="relative z-10">
          <NextAuthProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </NextAuthProvider>
        </div>
      </body>
    </html>
  );
}
