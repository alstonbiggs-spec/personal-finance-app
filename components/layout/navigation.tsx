'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
const links = [['/budget','Budget'],['/net-worth','Net Worth'],['/future-expenses','Future Expenses'],['/ontology','Ontology'],['/profile','Profile']];
export function Navigation() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [path]);
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign('/login');
  }
  return <header className="border-b hairline bg-cream">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
      <Link href="/budget" className="serif text-xl">Household Office</Link>
      <nav className="hidden gap-8 md:flex">{links.map(([href,label]) => <Link key={href} href={href} className={`border-b-2 pb-1 text-xs uppercase tracking-[.16em] transition ${path.startsWith(href) ? 'border-gold text-ink' : 'border-transparent text-ink/45 hover:text-ink'}`}>{label}</Link>)}</nav>
      <button onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden">
        <span className={`block h-px w-5 bg-ink/60 transition ${menuOpen ? 'translate-y-[3.5px] rotate-45' : ''}`} />
        <span className={`block h-px w-5 bg-ink/60 transition ${menuOpen ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
      </button>
      <button onClick={signOut} className="hidden text-xs uppercase tracking-[.16em] text-ink/50 hover:text-ink md:block">Sign out</button>
    </div>
    {menuOpen && <nav className="border-t hairline md:hidden"><div className="mx-auto flex max-w-7xl flex-col px-6">{links.map(([href,label]) => <Link key={href} href={href} className={`border-b hairline py-3.5 text-xs uppercase tracking-[.16em] ${path.startsWith(href) ? 'text-gold' : 'text-ink/60'}`}>{label}</Link>)}<button onClick={signOut} className="py-3.5 text-left text-xs uppercase tracking-[.16em] text-ink/50">Sign out</button></div></nav>}
  </header>;
}
