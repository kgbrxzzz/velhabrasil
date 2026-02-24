import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Swords, LogIn, UserPlus, Eye, EyeOff, MailCheck, RefreshCw } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(100),
});

const signupSchema = loginSchema.extend({
  username: z.string().trim().min(3, 'Mínimo 3 caracteres').max(20, 'Máximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e _'),
});

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos. Se você acabou de criar a conta, confirme seu email primeiro.';
  if (msg.includes('Email not confirmed')) return 'Você precisa confirmar seu email antes de fazer login. Verifique sua caixa de entrada.';
  if (msg.includes('User already registered')) return 'Este email já está cadastrado. Tente fazer login.';
  if (msg.includes('over_email_send_rate_limit') || msg.includes('security purposes')) return 'Aguarde alguns segundos antes de tentar novamente.';
  if (msg.includes('Signup requires a valid password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return msg;
}

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
        await signIn(email, password);
      } else {
        signupSchema.parse({ email, password, username });
        await signUp(email, password, username);
        setEmailSent(true);
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError(translateError(err.message || 'Erro ao autenticar'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) return;
    setResending(true);
    setError('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
    } catch (err: any) {
      setError(translateError(err.message || 'Erro ao reenviar'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Swords className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-display font-bold text-primary glow-trophy">
              VELHA BRASIL
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Jogo da velha competitivo online
          </p>
        </div>

        {/* Card */}
        <div className="card-game rounded-xl p-8">
          {emailSent ? (
            <div className="text-center py-8 space-y-4">
              <MailCheck className="w-16 h-16 text-primary mx-auto" />
              <h2 className="font-display font-bold text-xl text-foreground">VERIFIQUE SEU EMAIL</h2>
              <p className="text-muted-foreground">
                Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>. Clique no link para ativar sua conta.
              </p>
              <p className="text-muted-foreground text-sm">
                Não recebeu? Verifique a pasta de spam.
              </p>
              {error && (
                <p className="text-destructive text-sm font-semibold">{error}</p>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="px-6 py-2 rounded-lg bg-muted text-muted-foreground font-display font-semibold hover:text-foreground transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'REENVIANDO...' : 'REENVIAR EMAIL'}
                </button>
                <button
                  onClick={() => { setEmailSent(false); setIsLogin(true); setError(''); }}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-display font-semibold hover:opacity-90 transition-all"
                >
                  VOLTAR AO LOGIN
                </button>
              </div>
            </div>
          ) : (
          <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-3 rounded-lg font-display text-sm font-semibold transition-all ${
                isLogin 
                  ? 'bg-primary text-primary-foreground glow-primary' 
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              ENTRAR
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-3 rounded-lg font-display text-sm font-semibold transition-all ${
                !isLogin 
                  ? 'bg-primary text-primary-foreground glow-primary' 
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              CRIAR CONTA
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1">
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="SeuNome123"
                  maxLength={20}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="voce@email.com"
                maxLength={255}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                  placeholder="••••••"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm font-semibold">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-display font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 glow-primary"
            >
              {loading ? 'CARREGANDO...' : isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Trophy className="w-4 h-4 text-trophy" />
            <span>Conquiste troféus e suba no ranking!</span>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
