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
import { createUser } from '../../../services/User/create';
import { AuthFrame } from '../_components/AuthFrame';
import { usePcColorMode } from '../_components/color-mode';
import { usePcI18n } from '../_components/PcI18nProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = usePcI18n();
  const { mode } = usePcColorMode();
  const isDark = mode === 'dark';

  const [userid, setUserid] = useState('');
  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError(t('password_mismatch', 'Passwords do not match'));
      return;
    }

    setLoading(true);
    try {
      await createUser({
        userid,
        email,
        firstname,
        lastname,
        password,
        mobile: '',
      });

      setSuccess(t('registration_success', 'Registration successful, please sign in.'));
      setTimeout(() => router.push('/pc/login'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registration_failed', 'Registration failed'));
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
          maxWidth: 860,
          borderRadius: 6,
          bgcolor: isDark ? 'rgba(5, 18, 49, 0.66)' : 'rgba(255, 255, 255, 0.86)',
          border: `1px solid ${isDark ? 'rgba(182, 207, 255, 0.24)' : 'rgba(13,47,115,0.2)'}`,
          backdropFilter: 'blur(10px)',
          boxShadow: isDark
            ? '0 30px 60px rgba(4, 13, 36, 0.55)'
            : '0 18px 40px rgba(24, 69, 148, 0.18)',
        }}
      >
        <CardContent sx={{ p: { xs: 3.5, md: 5 } }}>
          <form onSubmit={onSubmit}>
            <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h3" sx={{ color: isDark ? '#f2f7ff' : '#13397f', fontWeight: 700 }}>
                {t('register_title', 'Create Account')}
              </Typography>
              <Typography sx={{ color: isDark ? 'rgba(242,247,255,0.7)' : 'rgba(19,57,127,0.75)', mt: 1 }}>
                {t('register_subtitle', 'Join ORBAI Travel Reimbursement Platform')}
              </Typography>
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <TextField
                  label={t('email', 'Email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    sx: {
                      bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                      color: isDark ? '#f2f7ff' : '#123773',
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' },
                  }}
                />
              </Box>
              <Box>
                <TextField
                  label={t('user_id', 'User ID')}
                  value={userid}
                  onChange={(e) => setUserid(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    sx: {
                      bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                      color: isDark ? '#f2f7ff' : '#123773',
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' },
                  }}
                />
              </Box>
              <Box>
                <TextField
                  label={t('last_name', 'Last Name')}
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    sx: {
                      bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                      color: isDark ? '#f2f7ff' : '#123773',
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' },
                  }}
                />
              </Box>
              <Box>
                <TextField
                  label={t('first_name', 'First Name')}
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    sx: {
                      bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                      color: isDark ? '#f2f7ff' : '#123773',
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' },
                  }}
                />
              </Box>
              <Box>
                <TextField
                  label={t('password', 'Password')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    sx: {
                      bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                      color: isDark ? '#f2f7ff' : '#123773',
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' },
                  }}
                />
              </Box>
              <Box>
                <TextField
                  label={t('confirm_password', 'Confirm Password')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    sx: {
                      bgcolor: isDark ? 'rgba(21, 38, 69, 0.78)' : 'rgba(245, 250, 255, 0.92)',
                      color: isDark ? '#f2f7ff' : '#123773',
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: isDark ? 'rgba(242,247,255,0.76)' : 'rgba(18,55,115,0.76)' },
                  }}
                />
              </Box>
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
              {loading ? t('registering', 'Registering...') : t('register', 'Register')}
            </Button>

            <Typography
              textAlign="center"
              sx={{ color: isDark ? 'rgba(242,247,255,0.75)' : 'rgba(18,55,115,0.75)' }}
            >
              {t('already_have_account', 'Already have an account?')}{' '}
              <Link href="/pc/login" style={{ color: '#63a4ff', fontWeight: 700 }}>
                {t('sign_in', 'Sign In')}
              </Link>
            </Typography>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
