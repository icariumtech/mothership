#!/usr/bin/env bash
# Blocks bare `npm` invocations and redirects to pnpm.
cmd=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
if echo "$cmd" | grep -qE '^\s*npm(\s|$)'; then
  echo "Use pnpm instead of npm. Replace \`npm\` with \`pnpm\` in your command." >&2
  exit 2
fi
