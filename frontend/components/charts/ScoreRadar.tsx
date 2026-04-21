import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

interface ScoreRadarProps {
  communication: number;
  technical_knowledge: number;
  problem_solving: number;
}

export default function ScoreRadar({ communication, technical_knowledge, problem_solving }: ScoreRadarProps) {
  const data = [
    { subject: 'Communication', value: Math.round((communication / 30) * 100), fullMark: 100 },
    { subject: 'Technical', value: Math.round((technical_knowledge / 40) * 100), fullMark: 100 },
    { subject: 'Problem Solving', value: Math.round((problem_solving / 30) * 100), fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <Radar dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
