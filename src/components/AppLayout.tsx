import { useAuth } from '@/hooks/useAuth';
import { NavLink, useLocation } from 'react-router-dom';
import { Swords, Trophy, Settings, LogOut, Home, Medal, User, Users } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const isGame = location.pathname.startsWith('/game/');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg text-primary">VELHA BRASIL</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/50 px-3 py-1 rounded-full">
            <Trophy className="w-4 h-4 text-trophy" />
            <span className="font-display font-bold text-sm text-trophy">{profile?.trophies ?? 0}</span>
          </div>
          <NavLink to="/profile" className="text-sm text-muted-foreground font-semibold hover:text-foreground transition-colors">{profile?.username}</NavLink>
          <button onClick={signOut} className="text-muted-foreground hover:text-destructive transition-colors" title="Sair">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      {children}

      {/* Bottom nav - hidden during game */}
      {!isGame && (
        <nav className="border-t border-border px-4 py-2 flex justify-around">
          <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Home className="w-5 h-5" />
            <span className="text-xs font-display font-semibold">INÍCIO</span>
          </NavLink>
          <NavLink to="/friends" className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Users className="w-5 h-5" />
            <span className="text-xs font-display font-semibold">AMIGOS</span>
          </NavLink>
          <NavLink to="/ranking" className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Medal className="w-5 h-5" />
            <span className="text-xs font-display font-semibold">RANKING</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Settings className="w-5 h-5" />
            <span className="text-xs font-display font-semibold">CONFIG</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
