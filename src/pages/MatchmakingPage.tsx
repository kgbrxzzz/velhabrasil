import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Loader2, Swords, Trophy, X } from 'lucide-react';

export default function MatchmakingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [dots, setDots] = useState('');

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

    // Clean up any stale matches (>15 min)
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

    // Remove any existing entry first, then join queue
    await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    await supabase.from('matchmaking_queue').insert({
      user_id: user.id,
      trophies: profile.trophies,
    });

    // Look for opponent in range
    const findMatch = async () => {
      const range = 100;
      const { data: opponents } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('user_id', user.id)
        .gte('trophies', Math.max(0, profile.trophies - range))
        .lte('trophies', profile.trophies + range)
        .order('created_at', { ascending: true })
        .limit(1);

      if (opponents && opponents.length > 0) {
        const opponent = opponents[0];
        
        // Create match
        const { data: match, error } = await supabase
          .from('matches')
          .insert({
            player1_id: user.id,
            player2_id: opponent.user_id,
            current_turn: user.id,
            status: 'playing',
            turn_started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (match && !error) {
          // Remove both from queue
          await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
          await supabase.from('matchmaking_queue').delete().eq('user_id', opponent.user_id);
          navigate(`/game/${match.id}`);
          return true;
        }
      }
      return false;
    };

    const searchStartedAt = new Date().toISOString();

    // Poll for match or check if someone else matched us
    const interval = setInterval(async () => {
      // Check if we were already matched (someone else created a match with us)
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

    return () => {
      clearInterval(interval);
      supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    };
  }, [user, profile, navigate]);

  const cancelSearch = async () => {
    if (user) {
      await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    }
    setSearching(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center animate-slide-up">
        {!searching ? (
          <>
            <div className="mb-8">
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
                Encontre um oponente na sua faixa de troféus
              </p>
            </div>
            <button
              onClick={startSearch}
              className="px-12 py-4 rounded-xl gradient-gold text-primary-foreground font-display font-bold text-xl hover:opacity-90 transition-all glow-primary animate-pulse-glow"
            >
              <Swords className="w-6 h-6 inline mr-3" />
              JOGAR
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">
              PROCURANDO OPONENTE{dots}
            </h2>
            <p className="text-muted-foreground mb-2">
              Faixa: {Math.max(0, (profile?.trophies ?? 0) - 100)} - {(profile?.trophies ?? 0) + 100} troféus
            </p>
            <button
              onClick={cancelSearch}
              className="mt-6 px-8 py-3 rounded-lg bg-muted text-muted-foreground font-display font-semibold hover:bg-destructive hover:text-destructive-foreground transition-all"
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
