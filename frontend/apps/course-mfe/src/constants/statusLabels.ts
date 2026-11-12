// 상태 코드를 화면 문구로 바꾼다 (D-01, D-02).
export const COURSE_STATUS_LABEL: Record<string, string> = {
  OPEN: '운영 중',
  CLOSED: '종료',
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  RECRUITING: '모집 중',
  CLOSED: '모집 마감',
  COMPLETED: '교육 완료',
};
