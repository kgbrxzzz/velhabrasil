import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const OnlineContext = createContext<Set<string>>(new Set());

export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setOnline(new Set());
      return;
    }

    const channel = supabase.channel('online-presence-global', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, ts: Date.now() });
        }
      });

    const interval = setInterval(() => {
      channel.track({ user_id: user.id, ts: Date.now() }).catch(() => undefined);
    }, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnlineUsers() {
  return useContext(OnlineContext);
}