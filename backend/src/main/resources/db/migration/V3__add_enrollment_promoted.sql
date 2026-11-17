-- FR-06·D-04: 대기에서 승급해 확정되었는지 기록한다. FR-07 내역, FR-09 알림이 이 값을 쓴다.
-- 기존 행은 모두 직접 확정 또는 대기이므로 false로 채운다.
ALTER TABLE enrollment ADD COLUMN promoted BOOLEAN NOT NULL DEFAULT FALSE;
