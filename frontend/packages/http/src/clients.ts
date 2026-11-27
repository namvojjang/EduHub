import {
  AuthApi,
  CourseAdminApi,
  CourseApi,
  EnrollmentAdminApi,
  EnrollmentApi,
} from '@eduhub/api-client';
import { http } from './http';

// 생성된 API 클래스는 이 파일에서만 만든다. 화면과 훅은 이 인스턴스를 가져다 쓴다.
// basePath를 ''로 두어 같은 출처의 /api로 요청하고, 개발 중에는 Vite 프록시가 백엔드로 넘긴다.
// Configuration.basePath에 ''를 넣으면 생성 코드가 빈 값으로 보고 스펙의 서버 주소(8080)를 써 버리므로,
// 생성자 두 번째 인자로 넘긴다. 세 번째 인자 http는 토큰 첨부·401 처리가 들어 있는 Axios 인스턴스다(NFR-03).
export const authApi = new AuthApi(undefined, '', http);
export const courseApi = new CourseApi(undefined, '', http);
/** 관리자용 과정·회차 API (FR-03). */
export const courseAdminApi = new CourseAdminApi(undefined, '', http);
export const enrollmentApi = new EnrollmentApi(undefined, '', http);
export const enrollmentAdminApi = new EnrollmentAdminApi(undefined, '', http);
