import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  date: string;
  score: number;
}

interface PerformanceLineProps {
  data: DataPoint[];
}

export default function PerformanceLine({ data }: PerformanceLineProps) {
  if (!data || data.length === 0) return null;

  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13 }}
          labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
        />
        <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 4 }} activeDot={{ r: 6, fill: '#c084fc' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
