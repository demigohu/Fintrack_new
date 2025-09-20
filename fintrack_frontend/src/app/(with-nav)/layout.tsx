import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google"
import "../globals.css";
import { BasicSidebar } from "@/components/basic-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { Toaster } from "@/components/ui/use-toast";

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
            <SidebarProvider>
              <BasicSidebar />
              <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-purple-500/20 bg-background/80 backdrop-blur-xl justify-end">
                <div className="flex items-center gap-2 px-4">
                  {/* <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink href="#">
                          Building Your Application
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb> */}
                  <ConnectWalletButton />
                </div>
              </header>
                {children}
              </SidebarInset>
            </SidebarProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
