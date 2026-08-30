import type { Viewport } from 'next';
import './globals.css';
export const metadata = {
  title: 'Simpli Finance',
  description: 'Private household wealth dashboard',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Simpli Finance' },
};
export const viewport: Viewport = { themeColor: '#18231f' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body suppressHydrationWarning>{children}</body></html>; }
