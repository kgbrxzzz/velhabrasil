
-- Add 2v2 support to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT '1v1';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player3_id uuid;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player4_id uuid;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS turn_order jsonb DEFAULT '[]'::jsonb;

-- Add 2v2 support to matchmaking_queue
ALTER TABLE public.matchmaking_queue ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT '1v1';
ALTER TABLE public.matchmaking_queue ADD COLUMN IF NOT EXISTS party_id uuid;

-- Update RLS policies for matches to include player3 and player4
DROP POLICY IF EXISTS "Players can view their matches" ON public.matches;
CREATE POLICY "Players can view their matches" ON public.matches
  FOR SELECT USING (
    auth.uid() = player1_id OR auth.uid() = player2_id OR auth.uid() = player3_id OR auth.uid() = player4_id
  );

DROP POLICY IF EXISTS "Players can update their matches" ON public.matches;
CREATE POLICY "Players can update their matches" ON public.matches
  FOR UPDATE USING (
    auth.uid() = player1_id OR auth.uid() = player2_id OR auth.uid() = player3_id OR auth.uid() = player4_id
  );
