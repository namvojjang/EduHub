#!/usr/bin/env bash
# .claude/hooks/format.sh — PostToolUse(Edit|Write): 수정한 파일만 포맷
# 포맷 도구가 없거나 실패해도 작업이 멈추지 않게 항상 exit 0 (막는 훅이 아니다)
command -v jq >/dev/null 2>&1 || exit 0
FILE=$(jq -r '.tool_input.file_path // empty')
FILE="${FILE//\\//}"   # Windows 경로의 \ 를 / 로 (Git Bash에서 실행돼도 경로는 \ 로 들어온다)
[ -z "$FILE" ] && exit 0

ROOT="${CLAUDE_PROJECT_DIR//\\//}"

case "$FILE" in
  *.java)
    # Spotless(google-java-format)로 backend 전체를 포맷한다. 이미 맞는 파일은 바뀌지 않는다
    (cd "$ROOT/backend" && ./gradlew spotlessApply -q) >/dev/null 2>&1 ;;
  *.ts|*.tsx)
    # frontend에 설치된 prettier만 쓴다. npx로 받으면 훅마다 내려받기를 시도할 수 있어 쓰지 않는다
    PRETTIER="$ROOT/frontend/node_modules/.bin/prettier"
    [ -x "$PRETTIER" ] && "$PRETTIER" --write "$FILE" >/dev/null 2>&1 ;;
esac
exit 0
