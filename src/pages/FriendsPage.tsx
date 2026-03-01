import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, UserPlus, Check, X, Swords, Search, Clock, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface FriendRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
}

interface FriendDisplay {
  friendshipId: string;
  friendId: string;
  username: string;
  trophies: number;
  isOnline: boolean;
  isPending: boolean;
  isIncoming: boolean;
}

export default function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendDisplay[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Track online presence
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-friends', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch friendships
  const fetchFriends = useCallback(async () => {
    if (!user) return;

    const { data: rows } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!rows) { setLoading(false); return; }

    const friendIds = rows.map((r: FriendRow) => r.requester_id === user.id ? r.addressee_id : r.requester_id);

    if (friendIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, trophies')
      .in('user_id', friendIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

    const list: FriendDisplay[] = rows.map((r: FriendRow) => {
      const friendId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
      const prof = profileMap.get(friendId);
      return {
        friendshipId: r.id,
        friendId,
        username: prof?.username ?? '???',
        trophies: prof?.trophies ?? 0,
        isOnline: onlineUsers.has(friendId),
        isPending: r.status === 'pending',
        isIncoming: r.status === 'pending' && r.addressee_id === user.id,
      };
    });

    // Sort: pending incoming first, then online, then offline
    list.sort((a, b) => {
      if (a.isIncoming && !b.isIncoming) return -1;
      if (!a.isIncoming && b.isIncoming) return 1;
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return 0;
    });

    setFriends(list);
    setLoading(false);
  }, [user, onlineUsers]);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  // Realtime updates for friendships
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('friendships-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchFriends();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchFriends]);

  // Search players
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, trophies')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('user_id', user.id)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const sendFriendRequest = async (targetId: string) => {
    if (!user) return;
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: targetId,
    });
    if (error) {
      if (error.code === '23505') toast.error('Pedido já enviado!');
      else toast.error('Erro ao enviar pedido');
      return;
    }
    toast.success('Pedido de amizade enviado!');
    setSearchResults(prev => prev.filter(p => p.user_id !== targetId));
    fetchFriends();
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    toast.success('Amizade aceita!');
    fetchFriends();
  };

  const removeFriend = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    toast.info('Removido');
    fetchFriends();
  };

  const inviteToMatch = async (friendId: string, mode: '1v1' | '2v2' = '1v1') => {
    if (!user) return;

    if (mode === '1v1') {
      const { data: match, error } = await supabase.from('matches').insert({
        player1_id: user.id,
        player2_id: friendId,
        status: 'playing',
        current_turn: user.id,
        turn_started_at: new Date().toISOString(),
        board: Array(9).fill(''),
        game_mode: '1v1',
      }).select().single();

      if (error || !match) { toast.error('Erro ao criar partida'); return; }

      await supabase.channel(`friend-invite-${friendId}`).send({
        type: 'broadcast', event: 'match-invite',
        payload: { matchId: match.id, fromId: user.id, mode: '1v1' },
      });
      toast.success('Convite enviado!');
      navigate(`/game/${match.id}?friendly=true`);
    } else {
      // 2v2 invite - create a waiting match, need 2 more players
      const { data: match, error } = await supabase.from('matches').insert({
        player1_id: user.id,
        player2_id: friendId, // friend on same team? No - friend joins red team for balance
        status: 'waiting',
        game_mode: '2v2',
        board: Array(25).fill(''),
        turn_order: [],
      }).select().single();

      if (error || !match) { toast.error('Erro ao criar partida'); return; }

      await supabase.channel(`friend-invite-${friendId}`).send({
        type: 'broadcast', event: 'match-invite',
        payload: { matchId: match.id, fromId: user.id, mode: '2v2' },
      });
      toast.success('Convite 2v2 enviado! Aguardando mais jogadores...');
    }
  };

  const alreadyFriend = (userId: string) => friends.some(f => f.friendId === userId);

  return (
    <div className="flex-1 p-4 max-w-lg mx-auto w-full animate-slide-up">
      <h1 className="font-display font-bold text-xl text-foreground mb-6 flex items-center gap-2">
        <Users className="w-6 h-6 text-primary" />
        AMIGOS
      </h1>

      {/* Search */}
      <div className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar jogador..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground font-body text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2.5 rounded-lg gradient-gold text-primary-foreground font-display text-xs font-bold hover:opacity-90 transition-all"
          >
            BUSCAR
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((p) => (
              <div key={p.user_id} className="card-game rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center">
                    <span className="text-xs font-display font-bold text-primary">{p.username[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-foreground">{p.username}</p>
                    <p className="text-xs text-trophy font-bold">🏆 {p.trophies}</p>
                  </div>
                </div>
                {alreadyFriend(p.user_id) ? (
                  <span className="text-xs text-muted-foreground font-display">JÁ ADICIONADO</span>
                ) : (
                  <button
                    onClick={() => sendFriendRequest(p.user_id)}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Adicionar amigo"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending requests */}
      {friends.filter(f => f.isIncoming).length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            PEDIDOS PENDENTES
          </h2>
          <div className="space-y-2">
            {friends.filter(f => f.isIncoming).map((f) => (
              <div key={f.friendshipId} className="card-game rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center">
                    <span className="text-xs font-display font-bold text-primary">{f.username[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-foreground">{f.username}</p>
                    <p className="text-xs text-trophy font-bold">🏆 {f.trophies}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptRequest(f.friendshipId)}
                    className="p-2 rounded-lg bg-win/10 text-win hover:bg-win/20 transition-colors"
                    title="Aceitar"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFriend(f.friendshipId)}
                    className="p-2 rounded-lg bg-lose/10 text-lose hover:bg-lose/20 transition-colors"
                    title="Recusar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h2 className="font-display text-xs text-muted-foreground mb-3">
          LISTA DE AMIGOS ({friends.filter(f => !f.isPending).length})
        </h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="font-display text-primary animate-pulse">CARREGANDO...</div>
          </div>
        ) : friends.filter(f => !f.isPending).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-display text-sm">NENHUM AMIGO AINDA</p>
            <p className="text-xs mt-1">Busque jogadores acima para adicionar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.filter(f => !f.isPending).map((f) => (
              <div key={f.friendshipId} className="card-game rounded-lg px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => navigate(`/profile/${f.friendId}`)}
                  className="flex items-center gap-3 text-left"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-muted/50 border border-border flex items-center justify-center">
                      <span className="text-sm font-display font-bold text-primary">{f.username[0]?.toUpperCase()}</span>
                    </div>
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${f.isOnline ? 'text-win fill-win' : 'text-muted-foreground fill-muted-foreground'}`}
                    />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-foreground">{f.username}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-trophy font-bold">🏆 {f.trophies}</span>
                      <span className={`text-[10px] font-display ${f.isOnline ? 'text-win' : 'text-muted-foreground'}`}>
                        {f.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                </button>
                <div className="flex gap-2">
                  {f.isOnline && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => inviteToMatch(f.friendId, '1v1')}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-display text-[10px] font-bold"
                        title="X1 amistoso 1v1"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        1v1
                      </button>
                      <button
                        onClick={() => inviteToMatch(f.friendId, '2v2')}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors font-display text-[10px] font-bold"
                        title="Convidar para 2v2"
                      >
                        <Users className="w-3.5 h-3.5" />
                        2v2
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => removeFriend(f.friendshipId)}
                    className="p-2 rounded-lg hover:bg-lose/10 text-muted-foreground hover:text-lose transition-colors"
                    title="Remover amigo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
