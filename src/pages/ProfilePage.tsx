import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Swords, Shield, Handshake, ArrowLeft, Crown, Target, Percent, User } from 'lucide-react';

interface ProfileData {
  id: string;
  user_id: string;
  username: string;
  trophies: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
  selected_piece: string;
  created_at: string;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const targetId = userId || user?.id;
  const isOwnProfile = targetId === user?.id;

  useEffect(() => {
    if (!targetId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetId)
        .single();
      if (data) setProfile(data as ProfileData);
      setLoading(false);
    };
    fetch();
  }, [targetId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-display text-primary animate-pulse text-xl">CARREGANDO...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground font-display">PERFIL NÃO ENCONTRADO</div>
      </div>
    );
  }

  const totalGames = profile.games_won + profile.games_lost + profile.games_drawn;
  const winRate = totalGames > 0 ? Math.round((profile.games_won / totalGames) * 100) : 0;
  const memberSince = new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const getTrophyTier = (trophies: number) => {
    if (trophies >= 1000) return { name: 'LENDÁRIO', color: 'text-trophy', bg: 'bg-trophy/10' };
    if (trophies >= 500) return { name: 'DIAMANTE', color: 'text-accent', bg: 'bg-accent/10' };
    if (trophies >= 200) return { name: 'OURO', color: 'text-trophy', bg: 'bg-trophy/10' };
    if (trophies >= 100) return { name: 'PRATA', color: 'text-muted-foreground', bg: 'bg-muted/30' };
    return { name: 'BRONZE', color: 'text-orange-400', bg: 'bg-orange-400/10' };
  };

  const tier = getTrophyTier(profile.trophies);

  return (
    <div className="flex-1 p-4 max-w-lg mx-auto w-full animate-slide-up">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-display text-xs">VOLTAR</span>
      </button>

      {/* Profile Card */}
      <div className="card-game rounded-xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-8 pb-6 text-center border-b border-border">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/50 border-2 border-primary flex items-center justify-center">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-display font-bold text-xl text-foreground">{profile.username}</h1>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-display font-bold ${tier.color} ${tier.bg}`}>
            {tier.name}
          </span>
          <p className="text-xs text-muted-foreground mt-2">Membro desde {memberSince}</p>
        </div>

        {/* Trophies */}
        <div className="px-6 py-5 border-b border-border text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy className="w-6 h-6 text-trophy" />
            <span className="font-display font-bold text-3xl text-trophy glow-trophy">{profile.trophies}</span>
          </div>
          <span className="text-xs text-muted-foreground font-display">TROFÉUS</span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-px bg-border">
          <StatCard icon={<Swords className="w-5 h-5 text-win" />} label="VITÓRIAS" value={profile.games_won} />
          <StatCard icon={<Shield className="w-5 h-5 text-lose" />} label="DERROTAS" value={profile.games_lost} />
          <StatCard icon={<Handshake className="w-5 h-5 text-secondary" />} label="EMPATES" value={profile.games_drawn} />
          <StatCard icon={<Target className="w-5 h-5 text-muted-foreground" />} label="PARTIDAS" value={totalGames} />
        </div>

        {/* Win Rate Bar */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <span className="font-display text-xs text-muted-foreground">TAXA DE VITÓRIA</span>
            </div>
            <span className="font-display font-bold text-sm text-foreground">{winRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${winRate}%`,
                background: `linear-gradient(90deg, hsl(var(--win)), hsl(var(--primary)))`,
              }}
            />
          </div>
        </div>
      </div>

      {/* View own settings */}
      {isOwnProfile && (
        <button
          onClick={() => navigate('/settings')}
          className="w-full mt-4 py-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all font-display text-sm font-semibold"
        >
          EDITAR PERFIL
        </button>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card-game px-4 py-4 flex flex-col items-center gap-1">
      {icon}
      <span className="font-display font-bold text-lg text-foreground">{value}</span>
      <span className="font-display text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
