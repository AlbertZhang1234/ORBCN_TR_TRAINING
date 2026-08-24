'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { loginByUserIdOrEmail } from '../../../services/Logon/login';
import { AuthFrame } from '../_components/AuthFrame';
import { usePcColorMode } from '../_components/color-mode';
import { usePcI18n } from '../_components/PcI18nProvider';
import { setSessionUser } from '../_components/session';

export default function LoginPage() {
  const router = useRouter();
  const { t } = usePcI18n();
  const { mode } = usePcColorMode();
  const isDark = mode === 'dark';

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginByUserIdOrEmail(account, password);
      setSessionUser(user);
      router.push('/pc/home');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame>
      <Card
        sx={{
          mx: 'auto',
          width: '100%',
          maxWidth: 560,
          borderRadius: 6,
          bgcolor: isDark ? 'rgba(5, 18, 49, 0.66)' : 'rgba(255, 255, 255, 0.86)',
          border: `1px solid ${isDark ? 'rgba(182, 207, 255, 0.24)' : 'rgba(13,47,115,0.2)'}`,
          backdropFilter: 'blur(10px)',
          boxShadow: isDark
            ? '0 30px 60px rgba(4, 13, 36, 0.55)'
            : '0 18px 40px rgba(24, 69, 148, 0.18)',
        }}
      >
        <CardContent sx={{ p: { xs: 3.5, md: 4.5 } }}>
          <form onSubmit={onSubmit}>
            <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h4" sx={{ color: isDark ? '#f2f7ff' : '#13397f', fontWeight: 700 }}>
                {t('login_title', 'Welcome Back')}
              </Typography>
              <Typography sx={{ color: isDark ? 'rgba(242,247,255,0.7)' : 'rgba(19,57,127,0.75)', mt: 1 }}>
                {t('login_subtitle', 'Please sign in to your account')}
              </Typography>
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label={t('account', 'User ID or Email')}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              fullWidth
              required
              InputProps={{
                sx: {
                  bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                  color: isDark ? '#f2f7ff' : '#123773',
                  borderRadius: 1.5,
                },
              }}
              InputLabelProps={{ sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' } }}
            />

            <TextField
              label={t('password', 'Password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              InputProps={{
                sx: {
                  bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                  color: isDark ? '#f2f7ff' : '#123773',
                  borderRadius: 1.5,
                },
              }}
              InputLabelProps={{ sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' } }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Link
                href="/pc/forgot-password"
                style={{ textDecoration: 'none' }}
              >
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    textDecoration: 'none',
                    color: isDark ? '#6ca6ff' : '#1e5abb',
                    fontWeight: 500,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {t('forgot_password', 'Forgot Password?')}
                </Typography>
              </Link>
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                py: 1.2,
                borderRadius: 3,
                fontSize: 17,
                fontWeight: 700,
                bgcolor: '#2455c3',
                '&:hover': { bgcolor: '#1e49a7' },
              }}
            >
              {loading ? t('signing_in', 'Signing in...') : t('sign_in', 'Sign In')}
            </Button>

            {/* <Typography
              textAlign="center"
              sx={{ color: isDark ? 'rgba(242,247,255,0.75)' : 'rgba(18,55,115,0.75)' }}
            >
              {t('no_account', 'No Account?')}{' '}
              <Link href="/pc/register" style={{ color: '#63a4ff', fontWeight: 700 }}>
                {t('register', 'Register')}
              </Link>
            </Typography> */}
            </Stack>
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
