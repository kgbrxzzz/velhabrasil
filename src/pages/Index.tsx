import { useAuth } from '@/hooks/useAuth';
import MatchmakingPage from '@/pages/MatchmakingPage';
import AppLayout from '@/components/AppLayout';

const Index = () => {
  return (
    <AppLayout>
      <MatchmakingPage />
    </AppLayout>
  );
};

export default Index;
