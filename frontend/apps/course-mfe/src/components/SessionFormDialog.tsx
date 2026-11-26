import type { SessionRequest } from '@eduhub/api-client';
import { Alert, Button, Drawer, Group, Stack, TextInput } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/errorMessage';

interface Props {
  open: boolean;
  /** 수정할 때의 기존 값. 없으면 등록. */
  initial?: SessionRequest;
  onClose: () => void;
  /** 실패하면 예외를 던진다. 서랍이 메시지를 보여 주고 열린 채로 남는다. */
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

/** 회차 등록·수정 서랍 (FR-03). 시작 시각은 미래여야 하고 정원은 1 이상이다. */
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
    <Drawer opened={open} onClose={onClose} position="right" size="md" title={initial ? '회차 수정' : '회차 추가'}>
      <form onSubmit={handleSubmit}>
        <Stack>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="시작 일시"
            type="datetime-local"
            required
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.currentTarget.value })}
          />
          <TextInput
            label="장소"
            required
            maxLength={200}
            value={form.place}
            onChange={(e) => setForm({ ...form, place: e.currentTarget.value })}
          />
          <TextInput
            label="정원"
            type="number"
            required
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" loading={saving}>
              저장
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
