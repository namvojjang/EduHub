#!/usr/bin/env bash
# .claude/hooks/protect-files.sh — PreToolUse(Edit|Write): 사람이 관리하는 파일 수정 차단
# 막을 때는 "이유 + 대신 할 일"을 stderr로 쓰고 exit 2 (Claude가 메시지를 읽고 다른 방법을 찾는다)
# jq가 없으면 검사할 수 없으므로 통과시키지 않고 막는다 (그냥 두면 보호가 조용히 꺼진다)
command -v jq >/dev/null 2>&1 || { echo "jq가 없어 보호 훅이 검사할 수 없습니다. 사람이 jq를 설치하세요 (Windows: winget install jqlang.jq)." >&2; exit 2; }
FILE=$(jq -r '.tool_input.file_path // empty')
FILE="${FILE//\\//}"   # Windows 경로의 \ 를 / 로 (Git Bash에서 실행돼도 경로는 \ 로 들어온다)
block() { echo "$1" >&2; exit 2; }

case "$FILE" in
  *application-prod.yml)
    block "운영 설정은 사람이 PR로만 수정합니다. 개발 설정은 application-dev.yml을 수정하세요." ;;
  *.env.example) ;;
  */.env|*/.env.*)
    block "비밀 파일은 수정하지 않습니다(NFR-03, NFR-06). 필요한 변수 이름은 .env.example에 값 없이 추가하세요." ;;
  */packages/api-client/src/*)
    block "백엔드 OpenAPI 스펙에서 자동 생성한 코드입니다(NFR-04). 백엔드 API를 고친 뒤 'npm run generate:api'로 다시 생성하세요." ;;
esac

# 이미 있는 마이그레이션만 막는다. 새 버전 파일 추가(Write)는 허용
if [[ "$FILE" == */db/migration/V*.sql && -f "$FILE" ]]; then
  block "기존 Flyway 마이그레이션은 수정할 수 없습니다. 다음 버전 번호(V<n+1>__설명.sql)로 새 파일을 추가하세요."
fi
exit 0
