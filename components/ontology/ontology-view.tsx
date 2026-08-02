'use client';
import { useState } from 'react';

const expenseTree = [
  { name: 'Needs', description: 'Required to operate the household safely and consistently.', color: '#173d35', children: [
    ['Housing & utilities', 'Rent, utilities, WiFi, phone bill'],
    ['Food & household', 'Groceries, eating out, Amazon, subscriptions'],
    ['Mobility', 'Gas / tolls, insurance, registration'],
    ['Health & wellness', 'Gym, massage, chiropractor'],
  ]},
  { name: 'Wants', description: 'Discretionary spending that supports quality of life.', color: '#ad8a50', children: [
    ['Dining & leisure', 'Restaurants, entertainment, hobbies'],
    ['Travel', 'Flights, hotels, trips and experiences'],
    ['Personal', 'Clothing, gifts, personal care'],
  ]},
  { name: 'Savings', description: 'Money deliberately moved toward future resilience or growth.', color: '#889e93', children: [
    ['Emergency fund', 'Cash reserve and near-term liquidity'],
    ['Investments', 'Brokerage, retirement, and long-term growth'],
  ]},
];

const cards = [
  { name: 'Amex Gold', institution: 'American Express', owner: 'Alston', bucket: 'Wants', purpose: 'Dining, groceries, and points', status: 'Not connected' },
  { name: 'Sapphire Preferred', institution: 'Chase', owner: 'Wife', bucket: 'Wants', purpose: 'Travel and shared experiences', status: 'Not connected' },
  { name: 'Household Checking', institution: 'Primary bank', owner: 'Joint', bucket: 'Needs', purpose: 'Rent, utilities, and recurring bills', status: 'Not connected' },
];

export function OntologyView() {
  const [open, setOpen] = useState('Needs');
  return <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
    <div className="mb-12"><p className="label mb-3">Household office · Taxonomy</p><h1 className="serif text-5xl">Ontology</h1><p className="mt-5 max-w-xl text-sm leading-6 text-ink/60">The shared language behind your household finances: what an expense means, where it belongs, and which account carries it.</p></div>
    <section className="grid gap-16 lg:grid-cols-[1.1fr_.9fr]">
      <div><div className="mb-6 flex items-end justify-between"><div><p className="label">Expense ontology</p><h2 className="serif mt-1 text-2xl">The three household layers</h2></div><span className="text-xs text-ink/45">3 top-level groups</span></div><div className="border-t hairline">{expenseTree.map(group => <div key={group.name} className="border-b hairline"><button onClick={() => setOpen(open === group.name ? '' : group.name)} className="flex w-full items-start gap-4 py-5 text-left"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{background:group.color}} /><span className="flex-1"><span className="block text-sm font-medium">{group.name}</span><span className="mt-1 block text-xs leading-5 text-ink/50">{group.description}</span></span><span className="text-gold">{open === group.name ? '−' : '+'}</span></button>{open === group.name && <div className="mb-5 ml-7 grid gap-2 border-l border-gold/40 pl-5">{group.children.map(([name, detail]) => <div key={name} className="bg-white/40 px-4 py-3"><p className="text-sm">{name}</p><p className="mt-1 text-xs text-ink/50">{detail}</p></div>)}</div>}</div>)}</div></div>
      <div><div className="mb-6"><p className="label">Account ontology</p><h2 className="serif mt-1 text-2xl">Cards & accounts</h2><p className="mt-3 text-sm leading-6 text-ink/60">Payment instruments are separate from expense meaning. A card tells us how an expense was paid; the ontology tells us what it was.</p></div><div className="space-y-3">{cards.map(card => <article key={card.name} className="border hairline bg-white/30 p-5"><div className="flex items-start justify-between"><div><p className="serif text-xl">{card.name}</p><p className="mt-1 text-xs text-ink/50">{card.institution}</p></div><span className="label">{card.status}</span></div><div className="mt-5 grid grid-cols-2 gap-4 border-t hairline pt-4 text-xs"><div><p className="label">Owner</p><p className="mt-1">{card.owner}</p></div><div><p className="label">Bucket</p><p className="mt-1">{card.bucket}</p></div><div className="col-span-2"><p className="label">Primary purpose</p><p className="mt-1">{card.purpose}</p></div></div></article>)}</div><button className="button-quiet mt-5">+ Add card or account</button></div>
    </section>
    <section className="mt-16 border-t hairline pt-8"><p className="label">How the model works</p><div className="mt-5 grid gap-6 text-sm md:grid-cols-3"><div><p className="serif text-lg">1. Meaning</p><p className="mt-2 leading-6 text-ink/55">Every transaction belongs to a spending category such as Groceries or Gas / Tolls.</p></div><div><p className="serif text-lg">2. Ownership</p><p className="mt-2 leading-6 text-ink/55">Each account has an owner—Alston, Wife, or Joint—without changing the expense meaning.</p></div><div><p className="serif text-lg">3. Flow</p><p className="mt-2 leading-6 text-ink/55">The card or account records the payment rail; the category records the household decision.</p></div></div></section>
  </main>;
}
