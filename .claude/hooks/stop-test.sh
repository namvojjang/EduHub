#!/usr/bin/env bash
# .claude/hooks/stop-test.sh — Stop: 백엔드 코드가 바뀌었으면 테스트를 돌리고, 실패하면 Claude가 계속 고치게 한다
# 막는 방법: exit 0 + stdout에 {"decision":"block","reason":"..."} (reason이 Claude에게 전달된다)
# jq가 없으면 입력을 읽을 수 없으므로 아무것도 하지 않는다 (막는 훅이 아니다)
command -v jq >/dev/null 2>&1 || exit 0
INPUT=$(cat)

# Stop 훅 때문에 이미 한 번 더 진행 중이면 반복하지 않는다 (무한 반복 방지)
[ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

ROOT="${CLAUDE_PROJECT_DIR//\\//}"
cd "$ROOT" || exit 0
# 커밋 안 된 백엔드 변경(새 파일 포함)이 없으면 테스트하지 않는다
[ -z "$(git status --porcelain -- backend/src backend/build.gradle.kts)" ] && exit 0

# -q를 쓰지 않는다: -q면 Gradle이 실패한 테스트 이름("XxxTest > yyy() FAILED")을 출력하지 않는다
if ! OUT=$(cd backend && ./gradlew test 2>&1); then
  # 토큰을 아끼려고 실패한 테스트와 바로 다음 줄(예외), 컴파일 오류, 요약만 20줄 넘긴다
  # 전체 결과는 backend/build/reports/tests/test/index.html
  FAILS=$(echo "$OUT" | grep -E -A1 ' FAILED$|error:|tests completed' | grep -v '^--$' | head -20)
  jq -n --arg r "백엔드 테스트(./gradlew test)가 실패했습니다. 원인을 고친 뒤 마무리하세요. 로컬 DB가 꺼져 있는 등 코드 밖의 원인이면 고치지 말고 사람에게 알리세요.
$FAILS" '{decision: "block", reason: $r}'
fi
exit 0
