import { CourseApi } from '@eduhub/api-client';

// 생성된 CourseApi는 이 파일에서만 만든다. 화면과 훅은 이 인스턴스를 가져다 쓴다.
// basePath를 ''로 두어 같은 출처의 /api로 요청하고, 개발 중에는 Vite 프록시가 백엔드로 넘긴다.
// Configuration.basePath에 ''를 넣으면 생성 코드가 빈 값으로 보고 스펙의 서버 주소(8080)를 써 버리므로,
// 생성자 두 번째 인자로 넘긴다.
export const courseApi = new CourseApi(undefined, '');
