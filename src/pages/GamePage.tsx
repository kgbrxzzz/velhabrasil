import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Clock, ArrowLeft, RotateCcw } from 'lucide-react';

const WINNING_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

const PIECE_OPTIONS: Record<string, { x: string; o: string }> = {
  classic: { x: '✕', o: '◯' },
  emoji: { x: '⚔️', o: '🛡️' },
  stars: { x: '★', o: '☆' },
  fire: { x: '🔥', o: '❄️' },
};

function checkWinner(board: string[]): string | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isDraw(board: string[]): boolean {
  return board.every(cell => cell !== '') && !checkWinner(board);
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<any>(null);
  const [board, setBoard] = useState<string[]>(Array(9).fill(''));
  const [timeLeft, setTimeLeft] = useState(10);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  const [winningCombo, setWinningCombo] = useState<number[] | null>(null);
  const [lastPlaced, setLastPlaced] = useState<number | null>(null);

  const isMyTurn = match?.current_turn === user?.id;
  const amPlayer1 = match?.player1_id === user?.id;
  const myMark = amPlayer1 ? 'X' : 'O';
  const pieceSkin = PIECE_OPTIONS[profile?.selected_piece || 'classic'] || PIECE_OPTIONS.classic;

  // Check if match is stale (>15 min)
  const isMatchStale = useCallback((matchData: any) => {
    if (!matchData || matchData.status === 'finished') return false;
    const created = new Date(matchData.created_at).getTime();
    const now = Date.now();
    return now - created > 15 * 60 * 1000;
  }, []);

  // Fetch match and subscribe
  useEffect(() => {
    if (!id) return;

    const fetchMatch = async () => {
      const { data } = await supabase.from('matches').select('*').eq('id', id).single();
      if (data) {
        // Auto-finish stale matches
        if (isMatchStale(data)) {
          await supabase.from('matches').update({ status: 'finished' }).eq('id', data.id);
          setMatch({ ...data, status: 'finished' });
          setBoard(data.board as string[]);
          setGameOver(true);
          setWinner(null);
          return;
        }
        setMatch(data);
        setBoard(data.board as string[]);
        if (data.status === 'finished') {
          setGameOver(true);
          setWinner(data.winner_id);
        }
      }
    };

    fetchMatch();

    const channel = supabase
      .channel(`match-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, (payload) => {
        const newMatch = payload.new as any;
        setMatch(newMatch);
        setBoard(newMatch.board as string[]);
        setTimeLeft(10);
        if (newMatch.status === 'finished') {
          setGameOver(true);
          setWinner(newMatch.winner_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Fetch opponent profile
  useEffect(() => {
    if (!match || !user) return;
    const opponentId = amPlayer1 ? match.player2_id : match.player1_id;
    if (opponentId) {
      supabase.from('profiles').select('*').eq('user_id', opponentId).single().then(({ data }) => {
        if (data) setOpponentProfile(data);
      });
    }
  }, [match, user, amPlayer1]);

  // Check for winning combo
  useEffect(() => {
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        setWinningCombo(combo);
        return;
      }
    }
    setWinningCombo(null);
  }, [board]);

  // Timer
  useEffect(() => {
    if (gameOver || !match || match.status !== 'playing') return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - other player wins
          if (isMyTurn) {
            handleTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [match, gameOver, isMyTurn]);

  // Reset timer on turn change
  useEffect(() => {
    setTimeLeft(10);
  }, [match?.current_turn]);

  const handleTimeUp = useCallback(async () => {
    if (!match || !user) return;
    const loserId = user.id;
    const winnerId = amPlayer1 ? match.player2_id : match.player1_id;
    
    await supabase.from('matches').update({
      status: 'finished',
      winner_id: winnerId,
    }).eq('id', match.id);

    await supabase.rpc('update_trophies', { winner: winnerId, loser: loserId });
  }, [match, user, amPlayer1]);

  const makeMove = async (index: number) => {
    if (!isMyTurn || board[index] || gameOver || !match) return;

    const newBoard = [...board];
    newBoard[index] = myMark;
    setLastPlaced(index);

    const win = checkWinner(newBoard);
    const draw = isDraw(newBoard);

    if (win) {
      const winnerId = user!.id;
      const loserId = amPlayer1 ? match.player2_id : match.player1_id;
      
      await supabase.from('matches').update({
        board: newBoard,
        status: 'finished',
        winner_id: winnerId,
      }).eq('id', match.id);

      await supabase.rpc('update_trophies', { winner: winnerId, loser: loserId });
      await refreshProfile();
    } else if (draw) {
      // Reset board for new round
      await supabase.from('matches').update({
        board: Array(9).fill(''),
        round: match.round + 1,
        current_turn: amPlayer1 ? match.player2_id : match.player1_id,
        turn_started_at: new Date().toISOString(),
      }).eq('id', match.id);
    } else {
      const nextTurn = amPlayer1 ? match.player2_id : match.player1_id;
      await supabase.from('matches').update({
        board: newBoard,
        current_turn: nextTurn,
        turn_started_at: new Date().toISOString(),
      }).eq('id', match.id);
    }
  };

  const renderCell = (value: string, index: number) => {
    const isWinning = winningCombo?.includes(index);
    const isNew = lastPlaced === index;
    let display = '';
    if (value === 'X') display = pieceSkin.x;
    else if (value === 'O') display = pieceSkin.o;

    return (
      <button
        key={index}
        onClick={() => makeMove(index)}
        disabled={!isMyTurn || !!value || gameOver}
        className={`
          aspect-square rounded-lg text-4xl sm:text-5xl font-bold transition-all duration-200
          flex items-center justify-center
          ${!value && isMyTurn && !gameOver 
            ? 'bg-muted/50 hover:bg-muted cursor-pointer hover:scale-105' 
            : 'bg-muted/30 cursor-default'}
          ${isWinning ? 'bg-win/20 ring-2 ring-win' : ''}
          ${value === 'X' ? 'text-primary' : 'text-secondary'}
          ${isNew ? 'animate-piece-place' : ''}
        `}
      >
        {display}
      </button>
    );
  };

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Carregando partida...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
      {/* Players bar */}
      <div className="w-full flex items-center justify-between mb-6 animate-slide-up">
        {/* Me */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isMyTurn && !gameOver ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/30'}`}>
          <div className="text-right">
            <p className="font-display font-bold text-sm truncate max-w-[80px]">{profile?.username ?? '...'}</p>
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-trophy" />
              <span className="text-xs text-trophy font-bold">{profile?.trophies ?? 0}</span>
            </div>
          </div>
          <span className="text-2xl">{amPlayer1 ? pieceSkin.x : pieceSkin.o}</span>
        </div>

        {/* Timer */}
        <div className={`flex flex-col items-center ${timeLeft <= 3 ? 'animate-timer-pulse' : ''}`}>
          <Clock className={`w-5 h-5 ${timeLeft <= 3 ? 'text-timer-danger' : 'text-muted-foreground'}`} />
          <span className={`font-display font-bold text-2xl ${timeLeft <= 3 ? 'text-timer-danger' : 'text-foreground'}`}>
            {timeLeft}
          </span>
          <span className="text-xs text-muted-foreground">Rodada {match.round}</span>
        </div>

        {/* Opponent */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${!isMyTurn && !gameOver ? 'bg-secondary/10 ring-1 ring-secondary' : 'bg-muted/30'}`}>
          <span className="text-2xl">{amPlayer1 ? pieceSkin.o : pieceSkin.x}</span>
          <div>
            <p className="font-display font-bold text-sm truncate max-w-[80px]">{opponentProfile?.username ?? '...'}</p>
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-trophy" />
              <span className="text-xs text-trophy font-bold">{opponentProfile?.trophies ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mb-4 text-center">
        {gameOver ? (
          <p className={`font-display font-bold text-xl ${!winner ? 'text-muted-foreground' : winner === user?.id ? 'text-win' : 'text-lose'}`}>
            {!winner ? '⏰ PARTIDA EXPIRADA' : winner === user?.id ? '🏆 VITÓRIA! +30 Troféus' : '💀 DERROTA! -20 Troféus'}
          </p>
        ) : (
          <p className={`font-display font-semibold ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
            {isMyTurn ? 'SUA VEZ!' : 'VEZ DO OPONENTE...'}
          </p>
        )}
      </div>

      {/* Board */}
      <div className="w-full max-w-xs mx-auto">
        <div className="grid grid-cols-3 gap-2 card-game p-4 rounded-xl">
          {board.map((cell, i) => renderCell(cell, i))}
        </div>
      </div>

      {/* Back button */}
      {gameOver && (
        <button
          onClick={() => { refreshProfile(); navigate('/'); }}
          className="mt-8 px-8 py-3 rounded-lg gradient-gold text-primary-foreground font-display font-bold hover:opacity-90 transition-all glow-primary"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          VOLTAR AO LOBBY
        </button>
      )}
    </div>
  );
}
