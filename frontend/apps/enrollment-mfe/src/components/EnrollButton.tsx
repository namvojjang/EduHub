import type { EnrollmentResponse } from '@eduhub/api-client';
import type { ErrorResponse } from '@eduhub/api-client';
import { Alert, Anchor, Button, Stack, Text } from '@mantine/core';
import axios from 'axios';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { enrollmentErrorMessage } from '../constants/enrollmentLabels';
import { useEnrollmentActions } from '../hooks/useEnrollmentActions';

interface EnrollButtonProps {
  sessionId: number;
  /** 있으면 신청할 수 없는 회차다. 비활성 버튼과 이유를 보여 준다. */
  disabledReason?: string;
  /** 화면의 회차 정보가 서버와 달라졌을 때 호출한다: 신청 성공(확정·대기 모두), 409 SESSION_NOT_RECRUITING. */
  onChanged?: () => void;
}

/** 회차 하나의 신청 버튼과 결과 (FR-04, FR-05). 결과 문구는 서버 응답(status, waitingNumber)으로만 정한다. */
export function EnrollButton({ sessionId, disabledReason, onChanged }: EnrollButtonProps) {
  const { pending, apply } = useEnrollmentActions();
  const [result, setResult] = useState<EnrollmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noticeId = useId();
  // loading이 화면에 반영되기 전의 빠른 두 번째 클릭을 막는다. 그래도 가면 서버가 DUPLICATE_ENROLLMENT로 막는다.
  const inFlight = useRef(false);

  // 결과를 disabledReason보다 먼저 본다: 마지막 자리를 신청해 회차가 마감으로 바뀌어도 결과가 사라지지 않게.
  if (result) {
    // 서버 응답의 status로만 문구를 정한다. 모르는 status는 단정하지 않는다.
    let message: string;
    let color = 'teal';
    if (result.status === 'CONFIRMED') {
      message = '신청이 확정되었습니다.';
    } else if (result.status === 'WAITING') {
      color = 'blue';
      message =
        typeof result.waitingNumber === 'number'
          ? `대기 ${result.waitingNumber}번으로 등록되었습니다.`
          : '대기로 등록되었습니다.';
    } else {
      color = 'gray';
      message = '신청이 접수되었습니다. 내 신청 내역에서 확인하세요.';
    }
    // 결과가 버튼 자리를 대체하므로 상시 live region을 둘 수 없다. 나타날 때 읽히도록 role="alert"를 쓴다.
    return (
      <Alert color={color} role="alert">
        <Stack gap={4}>
          <Text size="sm">{message}</Text>
          <Anchor component={Link} to="/my/enrollments" size="sm">
            내 신청 내역
          </Anchor>
        </Stack>
      </Alert>
    );
  }

  if (disabledReason) {
    return (
      <Stack gap={4} align="flex-end">
        <Button disabled aria-describedby={noticeId}>
          신청하기
        </Button>
        <Text id={noticeId} size="xs" c="dimmed">
          {disabledReason}
        </Text>
      </Stack>
    );
  }

  const handleClick = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    let changed = false;
    try {
      const response = await apply(sessionId);
      setResult(response);
      changed = true;
    } catch (e) {
      // 401은 인터셉터가 로그인 화면으로 보내므로 문구를 띄우지 않는다.
      setError(enrollmentErrorMessage(e));
      // 이미 마감된 회차: 화면의 "모집 중"이 낡았으니 다시 불러오게 한다. 중복 신청은 해당 없음.
      changed =
        axios.isAxiosError<ErrorResponse>(e) && e.response?.data?.code === 'SESSION_NOT_RECRUITING';
    } finally {
      inFlight.current = false;
    }
    // try/catch 밖에서 호출한다. onChanged가 던져도 신청 실패로 표시하지 않는다.
    if (changed) onChanged?.();
  };

  return (
    <Stack gap={4} align="flex-end">
      <Button
        onClick={handleClick}
        loading={pending}
        aria-describedby={error ? noticeId : undefined}
      >
        신청하기
      </Button>
      {error && (
        <Text id={noticeId} role="alert" size="sm" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
