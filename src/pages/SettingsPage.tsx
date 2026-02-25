import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Trophy, Gamepad2, Check, UserPen } from 'lucide-react';

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

  const [newUsername, setNewUsername] = useState(profile?.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from('profiles').update({ selected_piece: selectedPiece }).eq('user_id', profile.user_id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUsernameChange = async () => {
    if (!profile) return;
    const trimmed = newUsername.trim();
    
    if (trimmed.length < 3) {
      setUsernameError('Mínimo 3 caracteres');
      return;
    }
    if (trimmed.length > 20) {
      setUsernameError('Máximo 20 caracteres');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameError('Apenas letras, números e _');
      return;
    }
    if (trimmed === profile.username) return;

    setUsernameError('');
    setUsernameSaving(true);

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .neq('user_id', profile.user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      setUsernameError('Este nome já está em uso');
      setUsernameSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('user_id', profile.user_id);

    if (error) {
      setUsernameError(error.message.includes('unique') ? 'Este nome já está em uso' : 'Erro ao salvar');
      setUsernameSaving(false);
      return;
    }

    await refreshProfile();
    setUsernameSaving(false);
    setUsernameSaved(true);
    setTimeout(() => setUsernameSaved(false), 2000);
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

        {/* Username change */}
        <div className="card-game rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPen className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-sm text-muted-foreground">TROCAR NOME</h2>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setUsernameError(''); }}
              maxLength={20}
              className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Novo nome"
            />
            <button
              onClick={handleUsernameChange}
              disabled={usernameSaving || newUsername.trim() === profile?.username}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {usernameSaved ? <Check className="w-4 h-4" /> : usernameSaving ? '...' : 'SALVAR'}
            </button>
          </div>
          {usernameError && (
            <p className="text-destructive text-xs mt-2 font-semibold">{usernameError}</p>
          )}
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
          ) : saving ? 'SALVANDO...' : 'SALVAR PEÇA'}
        </button>
      </div>
    </div>
  );
}
