import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function LoginPage() {
  const { t } = useI18n();
  const { signInWithUsername, signUpWithUsername } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 上限 32 位与后台账号管理保持一致，避免注册出后台改不动的超长用户名
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
      toast.error(t('用户名需为 3–32 位字母、数字或下划线', 'Username must be 3-32 letters, digits or underscores'));
      return;
    }
    if (password.length < 6) {
      toast.error(t('密码至少 6 位', 'Password must be at least 6 characters'));
      return;
    }
    if (!agreed) {
      toast.error(t('请先同意用户协议与隐私政策', 'Please agree to the Terms and Privacy Policy'));
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signInWithUsername(username, password);
        if (error) { toast.error(t('登录失败，请检查账号或密码', 'Login failed, check your credentials')); return; }
        toast.success(t('登录成功', 'Welcome back'));
        navigate(from, { replace: true });
      } else {
        const { error } = await signUpWithUsername(username, password);
        if (error) {
          const msg = error.message || '';
          if (msg.includes('already')) toast.error(t('该用户名已被注册', 'Username already exists'));
          else toast.error(t('注册失败', 'Registration failed'));
          return;
        }
        toast.success(t('注册成功，已自动登录', 'Registered successfully'));
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-2">
      {/* Editorial left panel */}
      <div className="relative hidden flex-col justify-between bg-gradient-primary p-10 text-[#ecebe7] lg:flex lg:p-16">
        <div>
          <p className="font-mono-label text-xs uppercase tracking-[0.2em] text-[#8d9098]">№ 00 / AI 创业社区</p>
          <h1 className="mt-8 font-display text-4xl font-medium leading-tight tracking-tight text-balance">
            {t('每一个 AI 项目，', 'Every AI project')}
            <br />
            <span className="italic">{t('都值得被认真探索', 'deserves thoughtful exploration')}</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[#8d9098] text-pretty">
            {t('加入高端 AI 社区，浏览前沿案例、探索精选项目、参与线下连接。', 'Join the premium AI community — explore frontier cases, curated projects, and real-world connections.')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 font-mono-label text-xs text-[#5e626a]">
          <div>
            <p className="font-display text-2xl font-medium text-[#ecebe7]">100+</p>
            <p className="mt-1">{t('精选案例', 'Cases')}</p>
          </div>
          <div>
            <p className="font-display text-2xl font-medium text-[#ecebe7]">50+</p>
            <p className="mt-1">{t('AI 项目', 'Projects')}</p>
          </div>
          <div>
            <p className="font-display text-2xl font-medium text-[#ecebe7]">4</p>
            <p className="mt-1">{t('城市活动', 'Cities')}</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex gap-2 border border-border p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 font-mono-label text-xs uppercase tracking-wider transition-colors ${mode === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('登录', 'Sign in')}
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 font-mono-label text-xs uppercase tracking-wider transition-colors ${mode === 'register' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('注册', 'Sign up')}
            </button>
          </div>

          <h2 className="font-display text-2xl font-medium">
            {mode === 'login' ? t('欢迎回来', 'Welcome back') : t('创建账号', 'Create account')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {mode === 'login' ? t('登录以解锁完整社区体验', 'Sign in to unlock the full community') : t('注册后即可浏览、点赞、收藏与报名活动', 'Register to browse, like, save, and register for events')}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('用户名', 'Username')}</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_name" className="px-3" autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('密码', 'Password')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="px-3" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <Label htmlFor="agree" className="text-xs leading-relaxed text-muted-foreground">
                {t('我已阅读并同意', 'I agree to the')}{' '}
                <span className="text-foreground">{t('《用户协议》', 'Terms of Service')}</span>{' '}
                {t('与', 'and')}{' '}
                <span className="text-foreground">{t('《隐私政策》', 'Privacy Policy')}</span>
              </Label>
            </div>
            <Button type="submit" className="w-full font-mono-label text-xs uppercase tracking-wider" disabled={loading}>
              {loading ? t('处理中…', 'Processing…') : mode === 'login' ? t('登录', 'Sign in') : t('注册', 'Sign up')}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-accent">{t('返回首页', 'Back to home')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}