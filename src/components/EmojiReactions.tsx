import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const EMOJIS = [
  { emoji: '😂', label: 'Risada' },
  { emoji: '😭', label: 'Choro' },
  { emoji: '😡', label: 'Raiva' },
  { emoji: '😏', label: 'Provocação' },
  { emoji: '👏', label: 'Aplausos' },
  { emoji: '🤯', label: 'Choque' },
];

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  createdAt: number;
}

interface EmojiReactionsProps {
  matchId: string;
  userId: string;
}

export default function EmojiReactions({ matchId, userId }: EmojiReactionsProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [cooldown, setCooldown] = useState(false);

  // Listen for incoming reactions
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${matchId}`)
      .on('broadcast', { event: 'emoji' }, (payload) => {
        if (payload.payload.senderId !== userId) {
          spawnFloating(payload.payload.emoji);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, userId]);

  // Clean up old emojis
  useEffect(() => {
    const interval = setInterval(() => {
      setFloatingEmojis(prev => prev.filter(e => Date.now() - e.createdAt < 2500));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const spawnFloating = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 15 + Math.random() * 70; // 15%-85% horizontal
    setFloatingEmojis(prev => [...prev.slice(-8), { id, emoji, x, createdAt: Date.now() }]);
  }, []);

  const sendReaction = useCallback(async (emoji: string) => {
    if (cooldown) return;
    setCooldown(true);

    await supabase.channel(`reactions-${matchId}`).send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji, senderId: userId },
    });

    // Show own reaction too
    spawnFloating(emoji);

    setTimeout(() => setCooldown(false), 1500);
  }, [matchId, userId, cooldown, spawnFloating]);

  return (
    <>
      {/* Floating emojis overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingEmojis.map((fe) => (
          <span
            key={fe.id}
            className="absolute text-5xl animate-emoji-float"
            style={{ left: `${fe.x}%`, bottom: '20%' }}
          >
            {fe.emoji}
          </span>
        ))}
      </div>

      {/* Emoji picker bar */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {EMOJIS.map(({ emoji, label }) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            disabled={cooldown}
            title={label}
            className={`
              text-2xl p-2 rounded-lg transition-all duration-200
              hover:bg-muted/50 hover:scale-125 active:scale-90
              ${cooldown ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
