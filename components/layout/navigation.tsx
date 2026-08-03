'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [['/budget','Budget'],['/net-worth','Net Worth'],['/future-expenses','Future Expenses'],['/ontology','Ontology'],['/profile','Profile']];
export function Navigation() { const path = usePathname(); return <header className="border-b hairline bg-cream"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10"><Link href="/budget" className="serif text-xl">Household Office</Link><nav className="hidden gap-8 md:flex">{links.map(([href,label]) => <Link key={href} href={href} className={`border-b-2 pb-1 text-xs uppercase tracking-[.16em] transition ${path.startsWith(href) ? 'border-gold text-ink' : 'border-transparent text-ink/45 hover:text-ink'}`}>{label}</Link>)}</nav><button className="text-xs uppercase tracking-[.16em] text-ink/50">Sign out</button></div></header>; }
