#!/bin/bash
# 试跑一次构建，只看能不能过，不保留产物。
# 产物目录放在 node_modules 下：那里本来就不入库，不用额外加 .gitignore。
# （原来写死的是 /workspace/.dist，那是秒哒容器里的路径，本地根本不存在，
#   会让这一步直接报 ENOENT 失败。）

VITE_TEMP="node_modules/.vite-temp"
if [ -L "$VITE_TEMP" ]; then
    rm "$VITE_TEMP"
    mkdir -p "$VITE_TEMP"
elif [ ! -e "$VITE_TEMP" ]; then
    mkdir -p "$VITE_TEMP"
fi

OUT_DIR="node_modules/.test-build"

OUTPUT=$(npx vite build --minify false --logLevel error --outDir "$OUT_DIR" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "$OUTPUT"
fi

exit $EXIT_CODE
