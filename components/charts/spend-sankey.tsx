'use client';
import { Layer, Sankey, Tooltip } from 'recharts';
import type { SankeyLinkProps, SankeyNodeProps } from 'recharts';

// Same tones used everywhere else in the app (see spend-charts.tsx / money-flow.tsx) so
// a bucket always reads as the same color, wherever it shows up.
const colors = ['#173d35', '#ad8a50', '#889e93', '#b5bcb3'];
const bucketColors: Record<string, string> = { Needs: '#173d35', Wants: '#ad8a50', Savings: '#889e93' };
const colorFor = (name: string, index: number) => bucketColors[name] ?? colors[index % colors.length];

type ChartPoint = { name: string; value: number };
type Bucket = { name: string; value: number; subcategories: ChartPoint[] };

function buildSankeyData(root: string, total: number, buckets: Bucket[]) {
  const nodes: { name: string; color: string }[] = [{ name: root, color: '#18231f' }];
  const links: { source: number; target: number; value: number }[] = [];
  buckets.forEach((bucket, bucketIndex) => {
    if (bucket.value <= 0) return;
    const bucketNodeIndex = nodes.length;
    nodes.push({ name: bucket.name, color: colorFor(bucket.name, bucketIndex) });
    links.push({ source: 0, target: bucketNodeIndex, value: bucket.value });
    bucket.subcategories.forEach((sub, subIndex) => {
      if (sub.value <= 0) return;
      const subNodeIndex = nodes.length;
      nodes.push({ name: sub.name, color: colorFor(bucket.name, bucketIndex) });
      links.push({ source: bucketNodeIndex, target: subNodeIndex, value: sub.value });
    });
  });
  return { nodes, links, total };
}

function SankeyNode({ x, y, width, height, payload, containerWidth }: SankeyNodeProps & { containerWidth: number }) {
  const node = payload as unknown as { name: string; color: string; value: number; depth: number };
  const isOut = node.depth === 0 || x + width + 6 > containerWidth - 140;
  return (
    <Layer key={`node-${node.name}`}>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} fill={node.color} fillOpacity={0.9} rx={2} />
      <text x={isOut ? x - 8 : x + width + 8} y={y + height / 2} textAnchor={isOut ? 'end' : 'start'} dominantBaseline="middle" fontSize={12} fill="#18231f" fontWeight={node.depth === 0 ? 600 : 500}>
        {node.name}
      </text>
      <text x={isOut ? x - 8 : x + width + 8} y={y + height / 2 + 14} textAnchor={isOut ? 'end' : 'start'} dominantBaseline="middle" fontSize={10.5} fill="#66736b">
        ${Math.round(node.value).toLocaleString()}
      </text>
    </Layer>
  );
}

function SankeyLink(props: SankeyLinkProps) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
  const source = (payload as unknown as { source: { color: string } }).source;
  const path = `M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  return <path d={path} fill="none" stroke={source.color} strokeOpacity={0.35} strokeWidth={Math.max(linkWidth, 1)} />;
}

export function SpendSankey({ total = 0, buckets = [] }: { total?: number; buckets?: Bucket[] }) {
  const data = buildSankeyData('Total', total, buckets);
  if (total <= 0) {
    return <div className="flex h-72 items-center justify-center text-xs text-ink/40">No spend or savings this period.</div>;
  }
  const width = 1100;
  return (
    <div>
      <div className="mb-3 flex justify-between"><span className="label">Where it went</span><span className="serif text-2xl">${total.toLocaleString()}</span></div>
      <div className="overflow-x-auto">
        <Sankey
          width={width}
          height={440}
          data={data}
          nodeWidth={12}
          nodePadding={28}
          linkCurvature={0.55}
          margin={{ top: 10, right: 150, bottom: 10, left: 60 }}
          node={(props) => <SankeyNode {...(props as SankeyNodeProps)} containerWidth={width} />}
          link={(props) => <SankeyLink {...(props as unknown as SankeyLinkProps)} />}
        >
          <Tooltip formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]} />
        </Sankey>
      </div>
    </div>
  );
}
