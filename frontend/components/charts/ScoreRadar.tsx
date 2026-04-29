import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  communication: number;
  technical_knowledge: number;
  problem_solving: number;
}

export default function ScoreRadar({ communication, technical_knowledge, problem_solving }: Props) {
  const data = [
    { subject: 'Communication', value: communication },
    { subject: 'Technical', value: technical_knowledge },
    { subject: 'Problem Solving', value: problem_solving },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
        <Radar dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
