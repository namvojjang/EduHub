import type { CourseRequest } from '@eduhub/api-client';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/errorMessage';
import { CATEGORIES } from '../constants/categories';

interface Props {
  open: boolean;
  /** 수정할 때의 기존 값. 없으면 등록. */
  initial?: CourseRequest;
  onClose: () => void;
  /** 실패하면 예외를 던진다. 대화상자가 메시지를 보여 주고 열린 채로 남는다. */
  onSubmit: (body: CourseRequest) => Promise<void>;
}

const EMPTY: CourseRequest = { title: '', category: '', description: '' };

/** 과정 등록·수정 대화상자 (FR-03). */
export function CourseFormDialog({ open, initial, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CourseRequest>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY);
      setError(null);
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: form.title?.trim(),
        category: form.category,
        description: form.description?.trim() || undefined,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initial ? '과정 수정' : '과정 등록'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="과정명"
              required
              inputProps={{ maxLength: 200 }}
              value={form.title ?? ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              select
              label="분류"
              required
              value={form.category ?? ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="설명"
              multiline
              minRows={3}
              inputProps={{ maxLength: 2000 }}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>취소</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            저장
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
