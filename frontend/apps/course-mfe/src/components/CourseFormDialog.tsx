import type { CourseRequest } from '@eduhub/api-client';
import { Alert, Button, Drawer, Group, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { getErrorMessage } from '@eduhub/http';
import { CATEGORIES } from '../constants/categories';

interface Props {
  open: boolean;
  /** 수정할 때의 기존 값. 없으면 등록. */
  initial?: CourseRequest;
  onClose: () => void;
  /** 실패하면 예외를 던진다. 서랍이 메시지를 보여 주고 열린 채로 남는다. */
  onSubmit: (body: CourseRequest) => Promise<void>;
}

const EMPTY: CourseRequest = { title: '', category: '', description: '' };

/** 과정 등록·수정 서랍 (FR-03). 파일 이름은 이전 대화상자 때 그대로 둔다. */
export function CourseFormDialog({ open, initial, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CourseRequest>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY);
      setError(null);
      setCategoryError(null);
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Select의 보이는 입력은 readOnly라 브라우저 required 검증이 빠지므로 직접 확인한다.
    if (!form.category) {
      setCategoryError('분류를 선택하세요.');
      return;
    }
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
    <Drawer opened={open} onClose={onClose} position="right" size="md" title={initial ? '과정 수정' : '과정 등록'}>
      <form onSubmit={handleSubmit}>
        <Stack>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="과정명"
            required
            maxLength={200}
            value={form.title ?? ''}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Select
            label="분류"
            required
            allowDeselect={false}
            error={categoryError}
            data={[...CATEGORIES]}
            value={form.category || null}
            onChange={(value) => {
              setForm({ ...form, category: value ?? '' });
              setCategoryError(null);
            }}
          />
          <Textarea
            label="설명"
            autosize
            minRows={3}
            maxLength={2000}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
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
