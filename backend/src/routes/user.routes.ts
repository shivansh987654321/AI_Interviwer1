import { Router, Request, Response } from 'express';
import connectToDatabase from '../lib/db';
import Interview from '../models/Interview';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/:userId/stats', authenticate, async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    await connectToDatabase();
    const interviews = await Interview.find({ userId })
      .sort({ date: -1 })
      .select('sessionId date score feedback verdict difficulty')
      .lean();

    const total = interviews.length;
    if (total === 0) {
      return res.json({
        total: 0, avgScore: 0, bestScore: 0,
        currentStreak: 0, longestStreak: 0,
        domainBreakdown: {}, avgBreakdown: null,
        recentInterviews: [], scoreOverTime: [],
      });
    }

    const avgScore = Math.round(interviews.reduce((s, i) => s + i.score, 0) / total);
    const bestScore = Math.max(...interviews.map(i => i.score));

    // Unique interview days, newest first
    const uniqueDates = [...new Set(
      interviews.map(i => new Date(i.date).toDateString())
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();

    // Current streak — count consecutive days from today or yesterday
    let currentStreak = 0;
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const diffDays = Math.round(
          (new Date(uniqueDates[i - 1]).getTime() - new Date(uniqueDates[i]).getTime()) / 86_400_000
        );
        if (diffDays === 1) currentStreak++;
        else break;
      }
    }

    // Longest streak
    const ascDates = [...uniqueDates].reverse();
    let longestStreak = ascDates.length > 0 ? 1 : 0;
    let tempStreak = 1;
    for (let i = 1; i < ascDates.length; i++) {
      const diffDays = Math.round(
        (new Date(ascDates[i]).getTime() - new Date(ascDates[i - 1]).getTime()) / 86_400_000
      );
      if (diffDays === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    const recentInterviews = interviews.slice(0, 5).map(i => ({
      sessionId: i.sessionId,
      date:      i.date,
      score:     i.score,
      verdict:   i.verdict,
      domain:    i.difficulty || 'dsa',
      feedback:  (i.feedback || '').substring(0, 120),
    }));

    const scoreOverTime = [...interviews].reverse().map(i => ({
      date:   i.date,
      score:  i.score,
      domain: i.difficulty || 'dsa',
    }));

    res.json({
      total,
      avgScore,
      bestScore,
      currentStreak,
      longestStreak,
      domainBreakdown: {},
      avgBreakdown:    null,
      recentInterviews,
      scoreOverTime,
    });
  } catch (err) {
    console.error('[USER STATS] Error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
