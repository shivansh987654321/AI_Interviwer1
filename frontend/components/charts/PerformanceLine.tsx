import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { date: string; score: number }[];
}

export default function PerformanceLine({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
        <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
