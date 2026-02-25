#!/usr/bin/env bash
# 仅在 main 分支时执行构建，其它分支跳过。
# 在 Vercel 项目设置 → Git → Ignored Build Step 中填写: bash scripts/vercel-ignore-build.sh
# 参见: https://vercel.com/guides/how-do-i-use-the-ignored-build-step-field-on-vercel
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "✅ Branch is main — build will run"
  exit 1
else
  echo "🛑 Branch is $VERCEL_GIT_COMMIT_REF — build skipped"
  exit 0
fi
