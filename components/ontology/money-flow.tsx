function Node({ x, y, title, subtitle, tone = 'base' }: { x: number; y: number; title: string; subtitle: string; tone?: 'base' | 'savings' | 'wants' | 'needs' }) {
  const fills = { base: '#ffffff', savings: '#edf1ec', wants: '#f4eee3', needs: '#e8efeb' };
  const strokes = { base: '#a9b2aa', savings: '#889e93', wants: '#ad8a50', needs: '#173d35' };
  return <g><rect x={x} y={y} width={240} height={76} rx={5} fill={fills[tone]} stroke={strokes[tone]} strokeWidth={1.5} /><text x={x + 14} y={y + 29} fill="#18231f" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="600">{title}</text><text x={x + 14} y={y + 52} fill="#53615a" fontFamily="Arial, sans-serif" fontSize="12">{subtitle}</text></g>;
}

function Edge({ x1, y1, x2, y2, label, labelX, labelY }: { x1: number; y1: number; x2: number; y2: number; label?: string; labelX?: number; labelY?: number }) {
  return <g><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8b968e" strokeWidth={1.5} markerEnd="url(#arrow)" />{label && <text x={labelX ?? (x1 + x2) / 2} y={labelY ?? (y1 + y2) / 2 - 8} textAnchor="middle" fill="#66736b" fontFamily="Arial, sans-serif" fontSize="11">{label}</text>}</g>;
}

export function MoneyFlow() {
  return <div className="overflow-x-auto border-y hairline bg-white/20 py-6"><svg role="img" aria-labelledby="money-flow-title money-flow-desc" viewBox="0 0 1600 1080" className="min-w-[1200px]" width="100%" height="auto"><title id="money-flow-title">Top-to-bottom household money flow</title><desc id="money-flow-desc">Both paychecks flow down into the joint account, which branches into wants, needs, savings, and cards.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#8b968e" /></marker></defs>
    <Edge x1={800} y1={116} x2={800} y2={190} label="all income" labelX={850} labelY={158} />
    <Edge x1={920} y1={228} x2={1120} y2={318} label="$600 / 1st & 15th · $1,200/mo" labelX={1020} labelY={258} />
    <Edge x1={800} y1={266} x2={800} y2={318} label="direct charges" labelX={860} labelY={300} />
    <Edge x1={680} y1={228} x2={480} y2={318} label="$600 / 1st & 15th · $1,200/mo" labelX={580} labelY={258} />
    <Edge x1={800} y1={266} x2={800} y2={522} label="funds card" labelX={900} labelY={415} />
    <Edge x1={800} y1={266} x2={800} y2={720} label="funds card" labelX={940} labelY={555} />
    <Edge x1={920} y1={228} x2={1120} y2={520} label="$1,000–$2,000/mo" labelX={1040} labelY={370} />
    <Edge x1={920} y1={228} x2={1440} y2={520} label="$300/mo" labelX={1200} labelY={380} />
    <Edge x1={480} y1={356} x2={480} y2={522} label="funds card" labelX={540} labelY={445} />
    <Edge x1={480} y1={356} x2={480} y2={720} label="direct / debit" labelX={590} labelY={600} />
    <Edge x1={1120} y1={356} x2={1120} y2={522} label="funds card" labelX={1180} labelY={445} />
    <Edge x1={1120} y1={356} x2={1120} y2={720} label="direct / debit" labelX={1230} labelY={600} />
    <Edge x1={1440} y1={356} x2={1440} y2={522} label="savings" labelX={1500} labelY={445} />
    <Edge x1={128} y1={840} x2={400} y2={840} label="never touches joint account" labelY={820} />

    <Node x={680} y={40} title="💰 Income" subtitle="both paychecks" tone="base" />
    <Node x={680} y={190} title="🏦 USAA Joint Account" subtitle="= NEEDS bucket" tone="needs" />
    <Node x={360} y={318} title="🏦 Alston's USAA" subtitle="Wants Account" tone="wants" />
    <Node x={680} y={318} title="🧾 Needs Expenses" subtitle="Rent, direct debits" tone="needs" />
    <Node x={1000} y={318} title="🏦 Wife's USAA" subtitle="Wants Account" tone="wants" />
    <Node x={1320} y={318} title="📈 Fidelity Brokerage" subtitle="SAVINGS" tone="savings" />
    <Node x={360} y={522} title="💳 Amex Platinum" subtitle="Alston — Wants" tone="wants" />
    <Node x={680} y={522} title="💳 Amex Gold" subtitle="Alston — Needs" tone="needs" />
    <Node x={1000} y={522} title="💳 BoA Credit Card" subtitle="Wife — Wants" tone="wants" />
    <Node x={1320} y={522} title="💵 HYSA" subtitle="SAVINGS" tone="savings" />
    <Node x={360} y={720} title="🛍️ Alston's Wants" subtitle="Expenses" tone="wants" />
    <Node x={680} y={720} title="💳 Joint Debit Card" subtitle="Wife — Needs" tone="needs" />
    <Node x={1000} y={720} title="🛍️ Wife's Wants" subtitle="Expenses" tone="wants" />
    <Node x={40} y={802} title="🏢 Wife's Employer" subtitle="Match + Contribution" tone="base" />
    <Node x={400} y={802} title="📊 Wife's 401k" subtitle="SAVINGS" tone="savings" />
  </svg></div>;
}
