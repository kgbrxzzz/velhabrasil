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
        const { matchId, fromId } = payload.payload;
        toast('⚔️ Convite para X1 amistoso!', {
          duration: 15000,
          action: {
            label: 'ACEITAR',
            onClick: () => navigate(`/game/${matchId}?friendly=true`),
          },
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);

  return null;
}
