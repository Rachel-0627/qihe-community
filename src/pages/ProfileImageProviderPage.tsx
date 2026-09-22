import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import UserImageProviderConfig from '@/components/profile/UserImageProviderConfig';

export default function ProfileImageProviderPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/profile/image-provider' }, replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('返回个人中心', 'Back to profile')}
      </Button>
      <p className="editorial-label text-accent">{t('个人中心', 'Profile')}</p>
      <h1 className="mt-1 font-display text-2xl font-medium">{t('生图模型配置', 'Image Generation Provider')}</h1>
      <div className="mt-6">
        <UserImageProviderConfig />
      </div>
    </div>
  );
}
