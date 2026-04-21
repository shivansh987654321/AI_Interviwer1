import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SkillData {
  name: string;
  score: number;
  max: number;
}

interface SkillBreakdownProps {
  data: SkillData[];
}

const COLORS = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function SkillBreakdown({ data }: SkillBreakdownProps) {
  if (!data || data.length === 0) return null;

  const formatted = data.map(d => ({
    ...d,
    percent: Math.round((d.score / d.max) * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 5, right: 20, bottom: 5, left: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} width={110} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13 }}
          formatter={(value: unknown) => [`${value}%`, 'Score']}
        />
        <Bar dataKey="percent" radius={[0, 6, 6, 0]} barSize={20}>
          {formatted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
