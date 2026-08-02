import './globals.css';
export const metadata = { title: 'Household Office', description: 'Private household wealth dashboard' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body suppressHydrationWarning>{children}</body></html>; }
