import Leaderboard from '@/components/Leaderboard';
import { Trophy } from 'lucide-react';

export default function RankingPage() {
  return (
    <div className="flex-1 p-4 max-w-lg mx-auto w-full">
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-trophy" />
          <h1 className="text-2xl font-display font-bold">RANKING</h1>
        </div>
        <Leaderboard />
      </div>
    </div>
  );
}
