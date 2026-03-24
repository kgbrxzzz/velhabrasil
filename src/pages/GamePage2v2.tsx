import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Clock, ArrowLeft, RotateCcw } from 'lucide-react';
import EmojiReactions from '@/components/EmojiReactions';

const BOARD_SIZE = 5;
const WIN_LENGTH = 5;

function checkWinner5x5(board: string[]): string | null {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r * BOARD_SIZE + c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let k = 1; k < WIN_LENGTH; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
          if (board[nr * BOARD_SIZE + nc] === cell) count++;
          else break;
        }
        if (count >= WIN_LENGTH) return cell;
      }
    }
  }
  return null;
}

function getWinningCombo5x5(board: string[]): number[] | null {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r * BOARD_SIZE + c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        const combo = [r * BOARD_SIZE + c];
        for (let k = 1; k < WIN_LENGTH; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
          if (board[nr * BOARD_SIZE + nc] === cell) combo.push(nr * BOARD_SIZE + nc);
          else break;
        }
        if (combo.length >= WIN_LENGTH) return combo;
      }
    }
  }
  return null;
}

function isDraw(board: string[]): boolean {
  return board.every(cell => cell !== '') && !checkWinner5x5(board);
}

export default function GamePage2v2() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<any>(null);
  const [board, setBoard] = useState<string[]>(Array(25).fill(''));
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winningCombo, setWinningCombo] = useState<number[] | null>(null);
  const [lastPlaced, setLastPlaced] = useState<number | null>(null);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const timeUpHandled = useRef(false);
  const matchRef = useRef(match);
  matchRef.current = match;

  const turnOrder: string[] = match?.turn_order ?? [];
  const isMyTurn = match?.current_turn === user?.id;

  const getTeam = useCallback((playerId: string) => {
    const m = matchRef.current;
    if (!m) return null;
    if (playerId === m.player1_id || playerId === m.player3_id) return 'blue';
    return 'red';
  }, []);

  const myTeam = match ? (
    match.player1_id === user?.id || match.player3_id === user?.id ? 'blue' : 'red'
  ) : null;

  const getMyMark = () => myTeam === 'blue' ? 'X' : 'O';

  // Fetch match
  useEffect(() => {
    if (!id) return;
    const fetchMatch = async () => {
      const { data } = await supabase.from('matches').select('*').eq('id', id).single();
      if (data) {
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
      .channel(`match-2v2-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, (payload) => {
        const newMatch = payload.new as any;
        setMatch(newMatch);
        setBoard(newMatch.board as string[]);
        setTimeLeft(15);
        timeUpHandled.current = false;
        if (newMatch.status === 'finished') {
          setGameOver(true);
          setWinner(newMatch.winner_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Fetch all player profiles
  useEffect(() => {
    if (!match) return;
    const ids = [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean);
    if (ids.length === 0) return;
    supabase.from('profiles').select('*').in('user_id', ids).then(({ data }) => {
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(p => { map[p.user_id] = p; });
        setPlayers(map);
      }
    });
  }, [match?.player1_id, match?.player2_id, match?.player3_id, match?.player4_id]);

  // Check winning combo
  useEffect(() => {
    setWinningCombo(getWinningCombo5x5(board));
  }, [board]);

  // Handle time up
  const handleTimeUp = useCallback(async () => {
    const currentMatch = matchRef.current;
    if (!currentMatch || !user || timeUpHandled.current) return;
    timeUpHandled.current = true;

    const losingTeam = getTeam(user.id);
    const winnerTeam = losingTeam === 'blue' ? 'red' : 'blue';
    const winnerId = winnerTeam === 'blue' ? currentMatch.player1_id : currentMatch.player2_id;

    await supabase.from('matches').update({
      status: 'finished',
      winner_id: winnerId,
    }).eq('id', currentMatch.id);
  }, [user, getTeam]);

  // Timer
  useEffect(() => {
    if (gameOver || !match || match.status !== 'playing') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (matchRef.current?.current_turn === user?.id) {
            handleTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [match?.id, match?.status, gameOver, user?.id, handleTimeUp]);

  useEffect(() => {
    setTimeLeft(15);
    timeUpHandled.current = false;
  }, [match?.current_turn]);

  const makeMove = async (index: number) => {
    if (!isMyTurn || board[index] || gameOver || !match) return;

    const newBoard = [...board];
    const mark = getMyMark();
    newBoard[index] = mark;
    setLastPlaced(index);

    const win = checkWinner5x5(newBoard);
    const draw = isDraw(newBoard);

    if (win) {
      const winnerId = user!.id;
      await supabase.from('matches').update({
        board: newBoard,
        status: 'finished',
        winner_id: winnerId,
      }).eq('id', match.id);
      await refreshProfile();
    } else if (draw) {
      await supabase.from('matches').update({
        board: Array(25).fill(''),
        round: match.round + 1,
        current_turn: turnOrder.length > 0 ? turnOrder[0] : match.player1_id,
        turn_started_at: new Date().toISOString(),
      }).eq('id', match.id);
    } else {
      const currentIdx = turnOrder.indexOf(user!.id);
      const nextIdx = (currentIdx + 1) % turnOrder.length;
      await supabase.from('matches').update({
        board: newBoard,
        current_turn: turnOrder[nextIdx],
        turn_started_at: new Date().toISOString(),
      }).eq('id', match.id);
    }
  };

  const currentTurnTeam = match?.current_turn ? getTeam(match.current_turn) : null;
  const currentTurnPlayer = match?.current_turn ? players[match.current_turn] : null;

  const getResultText = () => {
    if (!winner) return '⏰ PARTIDA EXPIRADA';
    const winnerTeam = getTeam(winner);
    if (myTeam === winnerTeam) return '🏆 VITÓRIA DA SUA EQUIPE!';
    return '💀 DERROTA!';
  };

  const getResultColor = () => {
    if (!winner) return 'text-muted-foreground';
    const winnerTeam = getTeam(winner);
    return myTeam === winnerTeam ? 'text-win' : 'text-lose';
  };

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Carregando partida 2v2...
        </div>
      </div>
    );
  }

  const allPlayers = [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean);
  if (allPlayers.length < 4 && match.status !== 'playing' && match.status !== 'finished') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center animate-slide-up">
          <RotateCcw className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h2 className="font-display font-bold text-xl text-foreground mb-2">AGUARDANDO JOGADORES</h2>
          <p className="text-muted-foreground">{allPlayers.length}/4 jogadores conectados</p>
        </div>
      </div>
    );
  }

  const blueTeam = [match.player1_id, match.player3_id].filter(Boolean);
  const redTeam = [match.player2_id, match.player4_id].filter(Boolean);

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 max-w-lg mx-auto w-full overflow-y-auto">
      {/* Teams header */}
      <div className="w-full flex items-stretch justify-between mb-4 gap-2 animate-slide-up">
        <div className={`flex-1 rounded-lg p-2 border ${myTeam === 'blue' ? 'border-secondary ring-1 ring-secondary' : 'border-border'} bg-secondary/5`}>
          <p className="font-display text-[10px] font-bold text-secondary text-center mb-1">🔵 EQUIPE AZUL</p>
          {blueTeam.map(pid => (
            <div key={pid} className={`flex items-center gap-1.5 px-1.5 py-1 rounded ${match.current_turn === pid ? 'bg-secondary/20' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center">
                <span className="text-[8px] font-display font-bold text-secondary">{players[pid]?.username?.[0]?.toUpperCase() ?? '?'}</span>
              </div>
              <span className="text-xs font-display font-semibold truncate max-w-[60px] text-foreground">
                {players[pid]?.username ?? '...'}{pid === user?.id ? ' (eu)' : ''}
              </span>
            </div>
          ))}
        </div>

        <div className={`flex flex-col items-center justify-center px-3 ${timeLeft <= 3 ? 'animate-timer-pulse' : ''}`}>
          <Clock className={`w-5 h-5 ${timeLeft <= 3 ? 'text-timer-danger' : 'text-muted-foreground'}`} />
          <span className={`font-display font-bold text-2xl ${timeLeft <= 3 ? 'text-timer-danger' : 'text-foreground'}`}>
            {timeLeft}
          </span>
          <span className="text-[10px] text-muted-foreground font-display">R{match.round}</span>
        </div>

        <div className={`flex-1 rounded-lg p-2 border ${myTeam === 'red' ? 'border-destructive ring-1 ring-destructive' : 'border-border'} bg-destructive/5`}>
          <p className="font-display text-[10px] font-bold text-destructive text-center mb-1">🔴 EQUIPE VERMELHA</p>
          {redTeam.map(pid => (
            <div key={pid} className={`flex items-center gap-1.5 px-1.5 py-1 rounded ${match.current_turn === pid ? 'bg-destructive/20' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
                <span className="text-[8px] font-display font-bold text-destructive">{players[pid]?.username?.[0]?.toUpperCase() ?? '?'}</span>
              </div>
              <span className="text-xs font-display font-semibold truncate max-w-[60px] text-foreground">
                {players[pid]?.username ?? '...'}{pid === user?.id ? ' (eu)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Turn indicator */}
      <div className="mb-3 text-center">
        {gameOver ? (
          <p className={`font-display font-bold text-xl ${getResultColor()}`}>{getResultText()}</p>
        ) : (
          <p className={`font-display font-semibold text-sm ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
            {isMyTurn ? 'SUA VEZ!' : `Vez de ${currentTurnPlayer?.username ?? '...'} (${currentTurnTeam === 'blue' ? '🔵' : '🔴'})`}
          </p>
        )}
      </div>

      {/* 5x5 Board */}
      <div className="w-full max-w-xs mx-auto">
        <div className="grid grid-cols-5 gap-1.5 card-game p-3 rounded-xl">
          {board.map((cell, i) => {
            const isWinning = winningCombo?.includes(i);
            const isNew = lastPlaced === i;
            return (
              <button
                key={i}
                onClick={() => makeMove(i)}
                disabled={!isMyTurn || !!cell || gameOver}
                className={`
                  aspect-square rounded-md text-xl sm:text-2xl font-bold transition-all duration-200
                  flex items-center justify-center
                  ${!cell && isMyTurn && !gameOver
                    ? 'bg-muted/50 hover:bg-muted cursor-pointer hover:scale-105'
                    : 'bg-muted/30 cursor-default'}
                  ${isWinning ? 'ring-2 ring-win bg-win/20' : ''}
                  ${cell === 'X' ? 'text-secondary' : cell === 'O' ? 'text-destructive' : ''}
                  ${isNew ? 'animate-piece-place' : ''}
                `}
              >
                {cell === 'X' ? '✕' : cell === 'O' ? '◯' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Emoji Reactions */}
      {!gameOver && match.status === 'playing' && user && (
        <EmojiReactions matchId={match.id} userId={user.id} />
      )}

      {/* Back */}
      {gameOver && (
        <button
          onClick={() => { refreshProfile(); navigate('/'); }}
          className="mt-6 px-8 py-3 rounded-lg gradient-gold text-primary-foreground font-display font-bold hover:opacity-90 transition-all glow-primary"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          VOLTAR AO LOBBY
        </button>
      )}
    </div>
  );
}
