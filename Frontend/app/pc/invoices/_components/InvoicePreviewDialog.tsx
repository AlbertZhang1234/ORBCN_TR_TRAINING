
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useState, useEffect } from 'react';
import { getClientSessionId } from '../../../../services/_core/session';

interface InvoicePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceNo: string;
  sourceUrl?: string;
  t: (key: string, fallback: string) => string;
}

export default function InvoicePreviewDialog({
  open,
  onClose,
  invoiceNo,
  sourceUrl,
  t,
}: InvoicePreviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!open || !invoiceNo) {
      setPreviewUrl('');
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    let objectUrl = '';

    setLoading(true);
    setError(false);
    setPreviewUrl('');

    void (async () => {
      try {
        const response = await fetch(
          sourceUrl ?? `/api/invoice/source?invoiceNo=${encodeURIComponent(invoiceNo)}`,
          {
            method: 'GET',
            headers: {
              'x-session-id': getClientSessionId(),
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Preview fetch failed (${response.status})`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [invoiceNo, sourceUrl, open]);

  // Removed early return to allow Dialog to handle open/close animation properly
  // if (!invoiceNo) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{t('invoice_preview', 'Invoice Preview')}</Typography>
            {invoiceNo && <Typography variant="subtitle1" color="text.secondary">- {invoiceNo}</Typography>}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && !error && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {error ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography color="error">{t('preview_failed', 'Failed to load preview')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('file_not_found_or_error', 'File not found or server error')}
            </Typography>
          </Box>
        ) : (
          previewUrl && (
            <iframe
                src={previewUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                onLoad={() => setLoading(false)}
                onError={() => {
                setLoading(false);
                setError(true);
                }}
                title={`Preview ${invoiceNo}`}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
