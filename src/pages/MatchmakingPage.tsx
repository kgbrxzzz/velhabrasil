import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Loader2, Swords, Trophy, X, Users, User } from 'lucide-react';

type GameMode = '1v1' | '2v2';

export default function MatchmakingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [dots, setDots] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('1v1');

  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [searching]);

  const startSearch = useCallback(async () => {
    if (!user || !profile) return;
    setSearching(true);

    if (gameMode === '1v1') {
      await startSearch1v1();
    } else {
      await startSearch2v2();
    }
  }, [user, profile, navigate, gameMode]);

  const startSearch1v1 = async () => {
    if (!user || !profile) return;

    // Clean up stale matches
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: staleMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'playing')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .lt('created_at', fifteenMinAgo);

    if (staleMatches && staleMatches.length > 0) {
      for (const m of staleMatches) {
        await supabase.from('matches').update({ status: 'finished' }).eq('id', m.id);
      }
    }

    await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    await supabase.from('matchmaking_queue').insert({
      user_id: user.id,
      trophies: profile.trophies,
      game_mode: '1v1',
    });

    const findMatch = async () => {
      const range = 100;
      const { data: opponents } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('user_id', user.id)
        .eq('game_mode', '1v1')
        .gte('trophies', Math.max(0, profile.trophies - range))
        .lte('trophies', profile.trophies + range)
        .order('created_at', { ascending: true })
        .limit(1);

      if (opponents && opponents.length > 0) {
        const opponent = opponents[0];
        const { data: match, error } = await supabase
          .from('matches')
          .insert({
            player1_id: user.id,
            player2_id: opponent.user_id,
            current_turn: user.id,
            status: 'playing',
            turn_started_at: new Date().toISOString(),
            game_mode: '1v1',
          })
          .select()
          .single();

        if (match && !error) {
          await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
          await supabase.from('matchmaking_queue').delete().eq('user_id', opponent.user_id);
          navigate(`/game/${match.id}`);
          return true;
        }
      }
      return false;
    };

    const searchStartedAt = new Date().toISOString();
    const interval = setInterval(async () => {
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'playing')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .gte('created_at', searchStartedAt)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingMatch && existingMatch.length > 0) {
        await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
        clearInterval(interval);
        navigate(`/game/${existingMatch[0].id}`);
        return;
      }
      const found = await findMatch();
      if (found) clearInterval(interval);
    }, 2000);
  };

  const startSearch2v2 = async () => {
    if (!user || !profile) return;

    await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    await supabase.from('matchmaking_queue').insert({
      user_id: user.id,
      trophies: profile.trophies,
      game_mode: '2v2',
    });

    const searchStartedAt = new Date().toISOString();

    const tryForm2v2 = async () => {
      // Find 3 other players in 2v2 queue within trophy range
      const range = 150;
      const { data: queuePlayers } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('user_id', user.id)
        .eq('game_mode', '2v2')
        .gte('trophies', Math.max(0, profile.trophies - range))
        .lte('trophies', profile.trophies + range)
        .order('created_at', { ascending: true })
        .limit(3);

      if (queuePlayers && queuePlayers.length >= 3) {
        const p2 = queuePlayers[0];
        const p3 = queuePlayers[1];
        const p4 = queuePlayers[2];

        // Blue team: user + p3, Red team: p2 + p4
        // Turn order: Blue1, Red1, Blue2, Red2
        const turnOrder = [user.id, p2.user_id, p3.user_id, p4.user_id];

        // Random first team
        const blueFirst = Math.random() > 0.5;
        const finalTurnOrder = blueFirst
          ? [user.id, p2.user_id, p3.user_id, p4.user_id]
          : [p2.user_id, user.id, p4.user_id, p3.user_id];

        const firstPlayer = finalTurnOrder[0];

        const { data: match, error } = await supabase
          .from('matches')
          .insert({
            player1_id: user.id,       // blue1
            player2_id: p2.user_id,    // red1
            player3_id: p3.user_id,    // blue2
            player4_id: p4.user_id,    // red2
            current_turn: firstPlayer,
            status: 'playing',
            turn_started_at: new Date().toISOString(),
            game_mode: '2v2',
            board: Array(25).fill(''),
            turn_order: finalTurnOrder,
          })
          .select()
          .single();

        if (match && !error) {
          // Remove all from queue
          const allIds = [user.id, p2.user_id, p3.user_id, p4.user_id];
          for (const pid of allIds) {
            await supabase.from('matchmaking_queue').delete().eq('user_id', pid);
          }
          navigate(`/game2v2/${match.id}`);
          return true;
        }
      }
      return false;
    };

    const interval = setInterval(async () => {
      // Check if someone else already created a 2v2 match with us
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'playing')
        .eq('game_mode', '2v2')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id},player3_id.eq.${user.id},player4_id.eq.${user.id}`)
        .gte('created_at', searchStartedAt)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingMatch && existingMatch.length > 0) {
        await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
        clearInterval(interval);
        navigate(`/game2v2/${existingMatch[0].id}`);
        return;
      }

      const found = await tryForm2v2();
      if (found) clearInterval(interval);
    }, 2500);
  };

  const cancelSearch = async () => {
    if (user) {
      await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    }
    setSearching(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 gap-6 overflow-y-auto">
      <div className="text-center animate-slide-up w-full max-w-md">
        {!searching ? (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full mb-4">
                <Trophy className="w-5 h-5 text-trophy" />
                <span className="font-display font-bold text-trophy text-lg">
                  {profile?.trophies ?? 0}
                </span>
                <span className="text-muted-foreground text-sm">troféus</span>
              </div>
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                PRONTO PARA BATALHAR?
              </h2>
              <p className="text-muted-foreground">
                Escolha o modo e encontre oponentes
              </p>
            </div>

            {/* Mode selector + Play button */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setGameMode('1v1')}
                  className={`flex items-center gap-1.5 px-4 py-3 font-display font-bold text-sm transition-all ${
                    gameMode === '1v1'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User className="w-4 h-4" />
                  1v1
                </button>
                <button
                  onClick={() => setGameMode('2v2')}
                  className={`flex items-center gap-1.5 px-4 py-3 font-display font-bold text-sm transition-all ${
                    gameMode === '2v2'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  2v2
                </button>
              </div>

              {/* Play button */}
              <button
                onClick={startSearch}
                className="px-10 py-3 rounded-xl gradient-gold text-primary-foreground font-display font-bold text-xl hover:opacity-90 transition-all glow-primary animate-pulse-glow"
              >
                <Swords className="w-5 h-5 inline mr-2" />
                JOGAR
              </button>
            </div>

            {/* Mode description */}
            <div className="card-game rounded-lg p-3 text-sm text-muted-foreground">
              {gameMode === '1v1' ? (
                <p>🎯 <span className="text-foreground font-semibold">Clássico 1v1</span> — Jogo da Velha 3x3, mano a mano</p>
              ) : (
                <p>👥 <span className="text-foreground font-semibold">Equipes 2v2</span> — Tabuleiro 5x5, 5 em linha, Azul vs Vermelho</p>
              )}
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">
              {gameMode === '1v1' ? 'PROCURANDO OPONENTE' : 'FORMANDO EQUIPES'}{dots}
            </h2>
            <p className="text-muted-foreground mb-1">
              Modo: <span className="text-foreground font-semibold">{gameMode === '1v1' ? '1v1 Clássico' : '2v2 Equipes'}</span>
            </p>
            <p className="text-muted-foreground mb-2 text-sm">
              {gameMode === '1v1'
                ? `Faixa: ${Math.max(0, (profile?.trophies ?? 0) - 100)} - ${(profile?.trophies ?? 0) + 100} troféus`
                : `Procurando 3 jogadores na faixa de ${Math.max(0, (profile?.trophies ?? 0) - 150)} - ${(profile?.trophies ?? 0) + 150} troféus`
              }
            </p>
            <button
              onClick={cancelSearch}
              className="mt-4 px-8 py-3 rounded-lg bg-muted text-muted-foreground font-display font-semibold hover:bg-destructive hover:text-destructive-foreground transition-all"
            >
              <X className="w-4 h-4 inline mr-2" />
              CANCELAR
            </button>
          </>
        )}
      </div>
    </div>
  );
}
