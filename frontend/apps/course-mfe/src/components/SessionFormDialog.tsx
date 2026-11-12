import type { SessionRequest } from '@eduhub/api-client';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/errorMessage';

interface Props {
  open: boolean;
  /** 수정할 때의 기존 값. 없으면 등록. */
  initial?: SessionRequest;
  onClose: () => void;
  /** 실패하면 예외를 던진다. 대화상자가 메시지를 보여 주고 열린 채로 남는다. */
  onSubmit: (body: SessionRequest) => Promise<void>;
}

interface FormState {
  /** datetime-local 입력값 "2026-12-01T09:00" */
  startAt: string;
  place: string;
  capacity: string;
}

function toForm(initial?: SessionRequest): FormState {
  return {
    startAt: initial?.startAt ? initial.startAt.slice(0, 16) : '',
    place: initial?.place ?? '',
    capacity: initial?.capacity != null ? String(initial.capacity) : '',
  };
}

/** 회차 등록·수정 대화상자 (FR-03). 시작 시각은 미래여야 하고 정원은 1 이상이다. */
export function SessionFormDialog({ open, initial, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(initial));
      setError(null);
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        // 백엔드 LocalDateTime 형식에 맞춰 초를 붙인다.
        startAt: `${form.startAt}:00`,
        place: form.place.trim(),
        capacity: Number(form.capacity),
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
        <DialogTitle>{initial ? '회차 수정' : '회차 추가'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="시작 일시"
              type="datetime-local"
              required
              InputLabelProps={{ shrink: true }}
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            />
            <TextField
              label="장소"
              required
              inputProps={{ maxLength: 200 }}
              value={form.place}
              onChange={(e) => setForm({ ...form, place: e.target.value })}
            />
            <TextField
              label="정원"
              type="number"
              required
              inputProps={{ min: 1 }}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
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
