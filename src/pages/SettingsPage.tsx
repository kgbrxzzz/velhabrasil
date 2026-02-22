import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Settings, Trophy, Gamepad2, ChevronRight, Check } from 'lucide-react';

const PIECE_OPTIONS = [
  { id: 'classic', name: 'Clássico', x: '✕', o: '◯' },
  { id: 'emoji', name: 'Batalha', x: '⚔️', o: '🛡️' },
  { id: 'stars', name: 'Estrelas', x: '★', o: '☆' },
  { id: 'fire', name: 'Elementos', x: '🔥', o: '❄️' },
];

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [selectedPiece, setSelectedPiece] = useState(profile?.selected_piece || 'classic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.from('profiles').update({ selected_piece: selectedPiece }).eq('user_id', profile.user_id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 p-4 max-w-lg mx-auto w-full">
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">CONFIGURAÇÕES</h1>
        </div>

        {/* Stats */}
        <div className="card-game rounded-xl p-6 mb-6">
          <h2 className="font-display font-bold text-sm text-muted-foreground mb-4">ESTATÍSTICAS</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Trophy className="w-6 h-6 text-trophy mx-auto mb-1" />
              <p className="font-display font-bold text-2xl text-trophy">{profile?.trophies ?? 0}</p>
              <p className="text-xs text-muted-foreground">Troféus</p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-win">{profile?.games_won ?? 0}</p>
              <p className="text-xs text-muted-foreground">Vitórias</p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-lose">{profile?.games_lost ?? 0}</p>
              <p className="text-xs text-muted-foreground">Derrotas</p>
            </div>
          </div>
        </div>

        {/* Piece selection */}
        <div className="card-game rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Gamepad2 className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-sm text-muted-foreground">ESCOLHER PEÇA</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PIECE_OPTIONS.map(piece => (
              <button
                key={piece.id}
                onClick={() => setSelectedPiece(piece.id)}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  selectedPiece === piece.id
                    ? 'border-primary bg-primary/10 glow-primary'
                    : 'border-border bg-muted/30 hover:border-muted-foreground'
                }`}
              >
                <div className="text-3xl mb-2 flex items-center justify-center gap-2">
                  <span>{piece.x}</span>
                  <span className="text-muted-foreground text-sm">vs</span>
                  <span>{piece.o}</span>
                </div>
                <p className="font-display text-xs font-semibold">{piece.name}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || selectedPiece === profile?.selected_piece}
          className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-display font-bold hover:opacity-90 transition-all disabled:opacity-50 glow-primary"
        >
          {saved ? (
            <><Check className="w-4 h-4 inline mr-2" />SALVO!</>
          ) : saving ? 'SALVANDO...' : 'SALVAR'}
        </button>
      </div>
    </div>
  );
}
