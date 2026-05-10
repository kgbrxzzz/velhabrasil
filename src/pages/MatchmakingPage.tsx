import { useState, useEffect, useCallback, useRef } from 'react';
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (user) supabase.from('matchmaking_queue').delete().eq('user_id', user.id).then(() => undefined);
    };
  }, [user]);

  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [searching]);

  const cleanupSearch = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (user) {
      await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    }
  }, [user]);

  const startSearch = useCallback(async () => {
    if (!user || !profile) return;
    setSearching(true);

    if (gameMode === '1v1') {
      await startSearch1v1(user, profile);
    } else {
      await startSearch2v2(user, profile);
    }
  }, [user, profile, gameMode]);

  const startSearch1v1 = async (currentUser: NonNullable<typeof user>, currentProfile: NonNullable<typeof profile>) => {
    await supabase.from('matchmaking_queue').delete().eq('user_id', currentUser.id);

    const findMatch = async () => {
      const { data: matchId, error } = await (supabase as any).rpc('find_or_create_match_1v1', {
        _user_id: currentUser.id,
        _trophies: currentProfile.trophies,
      });

      if (error) {
        console.error('Erro no matchmaking 1v1:', error);
        return false;
      }

      if (matchId) {
        if (mountedRef.current) navigate(`/game/${matchId}`);
        return true;
      }

      return false;
    };

    await findMatch();
    intervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      const found = await findMatch();
      if (found && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 2000);
  };

  const startSearch2v2 = async (currentUser: NonNullable<typeof user>, currentProfile: NonNullable<typeof profile>) => {
    await supabase.from('matchmaking_queue').delete().eq('user_id', currentUser.id);

    const tryForm2v2 = async () => {
      const { data: matchId, error } = await (supabase as any).rpc('find_or_create_match_2v2', {
        _user_id: currentUser.id,
        _trophies: currentProfile.trophies,
      });

      if (error) {
        console.error('Erro no matchmaking 2v2:', error);
        return false;
      }

      if (matchId) {
        if (mountedRef.current) navigate(`/game2v2/${matchId}`);
        return true;
      }

      return false;
    };

    await tryForm2v2();
    intervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      const found = await tryForm2v2();
      if (found && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 2500);
  };

  const cancelSearch = async () => {
    await cleanupSearch();
    if (mountedRef.current) setSearching(false);
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

            <div className="flex items-center justify-center gap-3 mb-6">
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

              <button
                onClick={startSearch}
                className="px-10 py-3 rounded-xl gradient-gold text-primary-foreground font-display font-bold text-xl hover:opacity-90 transition-all glow-primary animate-pulse-glow"
              >
                <Swords className="w-5 h-5 inline mr-2" />
                JOGAR
              </button>
            </div>

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
