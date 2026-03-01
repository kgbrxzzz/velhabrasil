import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function FriendInviteListener() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`friend-invite-${user.id}`)
      .on('broadcast', { event: 'match-invite' }, (payload) => {
        const { matchId, mode } = payload.payload;
        const is2v2 = mode === '2v2';
        toast(is2v2 ? '👥 Convite para 2v2!' : '⚔️ Convite para X1 amistoso!', {
          duration: 15000,
          action: {
            label: 'ACEITAR',
            onClick: () => navigate(is2v2 ? `/game2v2/${matchId}` : `/game/${matchId}?friendly=true`),
          },
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);

  return null;
}
