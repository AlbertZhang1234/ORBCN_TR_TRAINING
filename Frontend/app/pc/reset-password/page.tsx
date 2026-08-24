'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { AuthFrame } from '../_components/AuthFrame';
import { usePcColorMode } from '../_components/color-mode';
import { usePcI18n } from '../_components/PcI18nProvider';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { mode } = usePcColorMode();
  const isDark = mode === 'dark';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage({ type: 'error', text: 'Missing reset token' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setMessage({ type: 'success', text: 'Password reset successfully. Redirecting to login...' });
      setTimeout(() => {
        router.push('/pc/login');
      }, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  return (
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
                Reset Password
              </Typography>
              <Typography sx={{ color: isDark ? 'rgba(242,247,255,0.7)' : 'rgba(19,57,127,0.75)', mt: 1 }}>
                Enter your new password below
              </Typography>
            </Box>

            {message && <Alert severity={message.type}>{message.text}</Alert>}

            <TextField
              label="New Password"
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

            <TextField
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.6,
                fontSize: '1.05rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                boxShadow: isDark
                  ? '0 8px 20px rgba(42, 108, 224, 0.35)'
                  : '0 8px 20px rgba(21, 57, 135, 0.22)',
              }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link href="/pc/login" style={{ textDecoration: 'none' }}>
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
                  Back to Login
                </Typography>
              </Link>
            </Box>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </AuthFrame>
  );
}
