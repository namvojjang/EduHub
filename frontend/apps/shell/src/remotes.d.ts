// remote가 노출하는 화면의 타입 선언(설계 2-2). remote는 별도 빌드라 shell은 타입을 직접 알 수 없다.
// remote의 실제 export는 모두 이름 있는 export다.
declare module 'courseMfe/CourseListPage' {
  export function CourseListPage(): JSX.Element;
}

declare module 'courseMfe/CourseDetailPage' {
  import type { SessionResponse } from '@eduhub/api-client';
  import type { ReactNode } from 'react';

  /** 회차 카드 안에 그릴 동작(신청 버튼 등). course-mfe는 신청을 모른다(설계 2-3). */
  export type SessionActionContext = { disabledReason?: string; onChanged: () => void };
  export function CourseDetailPage(props: {
    renderSessionAction?: (session: SessionResponse, ctx: SessionActionContext) => ReactNode;
  }): JSX.Element;
}

declare module 'courseMfe/AdminCourseListPage' {
  export function AdminCourseListPage(): JSX.Element;
}

declare module 'courseMfe/AdminCoursePage' {
  export function AdminCoursePage(): JSX.Element;
}

declare module 'enrollmentMfe/EnrollButton' {
  export function EnrollButton(props: {
    sessionId: number;
    disabledReason?: string;
    onChanged?: () => void;
  }): JSX.Element;
}

declare module 'enrollmentMfe/MyEnrollmentsPage' {
  export function MyEnrollmentsPage(): JSX.Element;
}

declare module 'enrollmentMfe/RosterPage' {
  /** 래퍼 없이 노출한다. 회차가 바뀌면 새로 만드는 key={sessionId}는 shell의 RosterRoute가 붙인다. */
  export function RosterPage(): JSX.Element;
}
