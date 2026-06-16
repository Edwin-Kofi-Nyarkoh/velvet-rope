import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppFooter } from "@/components/shell";

export const metadata: Metadata = {
  title: {
    default:  "Velvet Rope",
    template: "%s | Velvet Rope"
  },
  description:
    "The VIP event platform for everyone. Skip the line, own the night. Premium ticketing, invitations, QR check-ins, vendors, and analytics.",
  openGraph: {
    type:   "website",
    locale: "en_US"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Runs before hydration — removes dark class immediately if user chose light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('vr-theme')==='light')document.documentElement.classList.remove('dark')}catch(_){}`
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
