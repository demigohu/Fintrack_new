import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google"
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";

// const spaceGrotesk = Space_Grotesk({
//   subsets: ["latin"],
//   display: "swap",
//   variable: "--font-space-grotesk",
// })

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  // variable: "--font-dm-sans",
})

export const metadata: Metadata = {
  title: "FinTrack",
  description: "FinTrack Protocol",
  icons: {
    icon: "/fintrack.svg",
    shortcut: "/fintrack.svg",
    apple: "/fintrack.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.className} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
