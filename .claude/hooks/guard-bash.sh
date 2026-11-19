#!/usr/bin/env bash
# .claude/hooks/guard-bash.sh — PreToolUse(Bash): 위험 명령 차단 (최선의 노력용 안전망)
# 다른 형태의 명령은 빠져나갈 수 있다. settings.json의 deny와 GitHub main 브랜치 보호를 함께 쓴다
# jq가 없으면 검사할 수 없으므로 통과시키지 않고 막는다 (그냥 두면 보호가 조용히 꺼진다)
command -v jq >/dev/null 2>&1 || { echo "jq가 없어 보호 훅이 검사할 수 없습니다. 사람이 jq를 설치하세요 (Windows: winget install jqlang.jq)." >&2; exit 2; }
CMD=$(jq -r '.tool_input.command // empty')
block() { echo "$1" >&2; exit 2; }

# 운영 호스트·DB 이름 (팀 명명 규칙)
case "$CMD" in
  *eduhub-prod*|*prod-db*)
    block "운영 환경 접속 명령은 실행할 수 없습니다. 개발 DB(localhost)나 test 프로필을 사용하세요." ;;
  *flywayClean*)
    block "flywayClean은 DB를 모두 지웁니다. 개발 DB 초기화가 필요하면 사람에게 요청하세요." ;;
esac

# 강제 푸시: --force, --force-with-lease, -f (단어 단위로 본다)
if [[ "$CMD" =~ git[[:space:]]+push([[:space:]]+[^;&|]*)?[[:space:]](--force(-with-lease)?|-f)([[:space:]=]|$) ]]; then
  block "강제 푸시는 금지입니다. 이미 올린 커밋은 새 커밋으로 수정하세요."
fi

# main 직접 푸시: git push origin main, git push origin HEAD:main
if [[ "$CMD" =~ git[[:space:]]+push[[:space:]]+([^;&|]*[[:space:]])?origin[[:space:]]+([^[:space:];&|]*:)?main([[:space:];&|]|$) ]]; then
  block "main에 직접 푸시하지 않습니다. 작업 브랜치를 푸시하고 PR을 만드세요."
fi
exit 0
