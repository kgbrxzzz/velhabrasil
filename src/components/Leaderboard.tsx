import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Crown, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface LeaderboardEntry {
  id: string;
  username: string;
  trophies: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
  user_id: string;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, trophies, games_won, games_lost, games_drawn, user_id')
        .order('trophies', { ascending: false })
        .limit(50);
      if (data) setPlayers(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const displayPlayers = expanded ? players : players.slice(0, 5);
  const myRank = players.findIndex(p => p.user_id === user?.id) + 1;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-trophy" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-muted-foreground" style={{ color: 'hsl(220, 20%, 75%)' }} />;
    if (rank === 3) return <Medal className="w-5 h-5" style={{ color: 'hsl(25, 60%, 50%)' }} />;
    return <span className="w-5 text-center font-display font-bold text-sm text-muted-foreground">{rank}</span>;
  };

  const totalGames = (p: LeaderboardEntry) => p.games_won + p.games_lost + p.games_drawn;
  const winRate = (p: LeaderboardEntry) => {
    const total = totalGames(p);
    return total > 0 ? Math.round((p.games_won / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="card-game rounded-xl p-6">
        <div className="text-center text-muted-foreground font-display animate-pulse">CARREGANDO...</div>
      </div>
    );
  }

  return (
    <div className="card-game rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-trophy" />
          <h3 className="font-display font-bold text-foreground">RANKING</h3>
        </div>
        {myRank > 0 && (
          <span className="text-xs font-display text-muted-foreground">
            SUA POSIÇÃO: <span className="text-trophy font-bold">#{myRank}</span>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="divide-y divide-border">
        {displayPlayers.map((p, i) => {
          const rank = i + 1;
          const isMe = p.user_id === user?.id;
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/profile/${p.user_id}`)}
              className={`flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                isMe ? 'bg-primary/10' : 'hover:bg-muted/30'
              }`}
            >
              <div className="w-8 flex justify-center">{getRankIcon(rank)}</div>
              <div className="flex-1 min-w-0">
                <span className={`font-semibold text-sm truncate block ${isMe ? 'text-primary' : 'text-foreground'}`}>
                  {p.username} {isMe && '(você)'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.games_won}V {p.games_lost}D {p.games_drawn}E · {winRate(p)}% win
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-trophy" />
                <span className="font-display font-bold text-sm text-trophy">{p.trophies}</span>
              </div>
            </div>
          );
        })}
        {players.length === 0 && (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            Nenhum jogador ainda
          </div>
        )}
      </div>

      {/* Expand/Collapse */}
      {players.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 border-t border-border text-muted-foreground hover:text-foreground text-xs font-display font-semibold flex items-center justify-center gap-1 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'MOSTRAR MENOS' : `VER TODOS (${players.length})`}
        </button>
      )}
    </div>
  );
}
