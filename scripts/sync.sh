#!/bin/bash
# 猫国建设者 - 智能同步脚本
# 自动检测版本更新 + 模块/语言/主题等结构性变更
#
# 用法:
#   ./scripts/sync.sh                 # 检查所有变更，确认后同步
#   ./scripts/sync.sh --check         # 仅检查，不下载
#   ./scripts/sync.sh --force         # 跳过确认，直接同步

set -e

BASE_URL="https://cat.g8hh.com.cn"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../app" && pwd)"
TMP_DIR=$(mktemp -d)
REV_PARAM="rev_=863"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
REFERER="${BASE_URL}/"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[sync]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[err]${NC} $1"; }
info() { echo -e "${CYAN}       ${NC} $1"; }

download() {
    curl -sS --connect-timeout 10 -L \
        -H "User-Agent: $UA" \
        -H "Referer: $REFERER" \
        -H "Accept: */*" \
        "$1" -o "$2" 2>/dev/null
}

# ---- 从 index.html 提取模块列表 ----
parse_modules() {
    # 提取 var modules = [...] 数组内容，每行一个模块名
    sed -n '/var modules/,/];/p' "$1" \
        | grep -oP '"[^"]+"' \
        | tr -d '"' \
        | grep -v '^$'
}

# ---- 从 config.js 提取 locales 和 schemes ----
parse_config_item() {
    # parse_config_item <file> <key>
    # 提取 key: [...] 数组中的字符串
    grep -oP "${2}[[:space:]]*:[[:space:]]*\[[^\]]*\]" "$1" \
        | grep -oP '"[^"]+"' \
        | tr -d '"'
}

# ---- 比较两个列表 ----
diff_lists() {
    # 输出: 新增项 (在 $2 但不在 $1 中)
    comm -13 <(echo "$1" | sort) <(echo "$2" | sort)
}

missing_lists() {
    # 输出: 已移除项 (在 $1 但不在 $2 中)
    comm -23 <(echo "$1" | sort) <(echo "$2" | sort)
}

# ========================================================
#  分析阶段 - 下载远程 index.html 和 config.js 做对比
# ========================================================
analyze() {
    local has_changes=0

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   猫国建设者 - 更新检测报告         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
    echo ""

    # --- 1. 版本号检查 ---
    log "检查 buildRevision..."
    download "${BASE_URL}/build.version.json" "$TMP_DIR/remote_version.json"
    REMOTE_REV=$(grep -oP '"buildRevision"[^0-9]*\K[0-9]+' "$TMP_DIR/remote_version.json" 2>/dev/null || echo "0")
    LOCAL_REV=$(grep -oP '"buildRevision"[^0-9]*\K[0-9]+' "$APP_DIR/build.version.json" 2>/dev/null || echo "0")

    if [ "$REMOTE_REV" -gt "$LOCAL_REV" ] 2>/dev/null; then
        info "版本: r${LOCAL_REV} → r${REMOTE_REV}  ${YELLOW}◆ 有新版本${NC}"
        has_changes=1
    else
        info "版本: r${LOCAL_REV} (已是最新)"
    fi

    # --- 2. 模块列表检查 ---
    log "检查游戏模块..."
    download "${BASE_URL}/index.html" "$TMP_DIR/remote_index.html"

    REMOTE_MODULES=$(parse_modules "$TMP_DIR/remote_index.html")
    LOCAL_MODULES=$(parse_modules "$APP_DIR/index.html")

    NEW_MODULES=$(diff_lists "$LOCAL_MODULES" "$REMOTE_MODULES")
    REMOVED_MODULES=$(missing_lists "$LOCAL_MODULES" "$REMOTE_MODULES")

    if [ -n "$NEW_MODULES" ]; then
        warn "发现新增模块:"
        echo "$NEW_MODULES" | while read m; do
            local ftype="JS"
            local ext=".js"
            echo "$m" | grep -q "jsx" && ftype="JSX" && ext=".jsx.js"
            info "  + ${ftype}  ${m}"
        done
        has_changes=1
    fi
    if [ -n "$REMOVED_MODULES" ]; then
        info "已移除模块: $(echo "$REMOVED_MODULES" | tr '\n' ' ')"
    fi

    # --- 3. 语言包检查 ---
    log "检查语言包..."
    download "${BASE_URL}/config.js" "$TMP_DIR/remote_config.js"

    REMOTE_LOCALES=$(parse_config_item "$TMP_DIR/remote_config.js" "locales")
    LOCAL_LOCALES=$(parse_config_item "$APP_DIR/config.js" "locales")

    NEW_LOCALES=$(diff_lists "$LOCAL_LOCALES" "$REMOTE_LOCALES")
    if [ -n "$NEW_LOCALES" ]; then
        warn "发现新增语言: $(echo "$NEW_LOCALES" | tr '\n' ' ')"
        has_changes=1
    fi

    # --- 4. 主题检查 ---
    log "检查配色方案..."
    REMOTE_SCHEMES=$(parse_config_item "$TMP_DIR/remote_config.js" "schemes")
    LOCAL_SCHEMES=$(parse_config_item "$APP_DIR/config.js" "schemes")

    NEW_SCHEMES=$(diff_lists "$LOCAL_SCHEMES" "$REMOTE_SCHEMES")
    if [ -n "$NEW_SCHEMES" ]; then
        warn "发现新增主题: $(echo "$NEW_SCHEMES" | tr '\n' ' ')"
        info "  (主题 CSS 按需加载，无需额外下载)"
        has_changes=1
    fi

    # --- 5. 额外资源检查 ---
    log "检查汉化脚本..."
    download "${BASE_URL}/chs/" "$TMP_DIR/remote_chs.html" 2>/dev/null || true
    # 简单检查 chs 目录下是否有新文件(如果有 nginx autoindex)
    # 这里保守处理，不强制检测 chs 目录

    # --- 汇总 ---
    echo ""
    if [ "$has_changes" -eq 0 ]; then
        log "✅ 所有内容均为最新，无需更新。"
        return 1
    else
        log "⚠ 检测到变更，建议同步。"
        return 0
    fi
}

# ========================================================
#  同步阶段
# ========================================================
sync_all() {
    log "开始同步..."

    # 确保使用最新的模块列表来下载
    if [ -f "$TMP_DIR/remote_index.html" ]; then
        REMOTE_MODULES=$(parse_modules "$TMP_DIR/remote_index.html")
    else
        download "${BASE_URL}/index.html" "$TMP_DIR/remote_index.html"
        REMOTE_MODULES=$(parse_modules "$TMP_DIR/remote_index.html")
    fi

    # --- 下载每个模块 ---
    echo "$REMOTE_MODULES" | while IFS= read -r module; do
        # 跳过注释
        [ -z "$module" ] && continue
        echo "$module" | grep -q "^//" && continue

        if echo "$module" | grep -q "jsx"; then
            # JSX 模块: 文件名本身是 .jsx, 加载时加 .js → .jsx.js
            local dir=$(dirname "$module")
            local name=$(basename "$module")
            mkdir -p "$TMP_DIR/$dir"
            download "${BASE_URL}/${module}.js?${REV_PARAM}" "$TMP_DIR/${module}.js"
        else
            # 普通 JS 模块
            local dir=$(dirname "$module")
            [ "$dir" != "." ] && mkdir -p "$TMP_DIR/$dir"
            download "${BASE_URL}/${module}.js" "$TMP_DIR/${module}.js"
        fi
    done

    # --- 核心文件 ---
    log "同步核心文件..."
    for f in config.js core.js game.js i18n.js build.version.json; do
        download "${BASE_URL}/${f}" "$TMP_DIR/${f}"
        cp "$TMP_DIR/${f}" "$APP_DIR/${f}"
    done

    # --- 模块文件 ---
    log "同步游戏模块..."
    echo "$REMOTE_MODULES" | while IFS= read -r module; do
        [ -z "$module" ] && continue
        echo "$module" | grep -q "^//" && continue

        if echo "$module" | grep -q "jsx"; then
            cp "$TMP_DIR/${module}.js" "$APP_DIR/${module}.js"
        else
            cp "$TMP_DIR/${module}.js" "$APP_DIR/${module}.js"
        fi
    done

    # --- 样式 ---
    log "同步样式..."
    download "${BASE_URL}/res/default.css" "$TMP_DIR/res/default.css"
    cp "$TMP_DIR/res/default.css" "$APP_DIR/res/default.css"

    # --- i18n ---
    log "同步语言文件..."
    mkdir -p "$TMP_DIR/res/i18n/crowdin" "$APP_DIR/res/i18n/crowdin"

    # 获取远程语言列表
    if [ -f "$TMP_DIR/remote_config.js" ]; then
        REMOTE_LOCALES=$(parse_config_item "$TMP_DIR/remote_config.js" "locales")
    else
        REMOTE_LOCALES="zh"
    fi

    # 下载 en (fallback) + crowdin 翻译
    download "${BASE_URL}/res/i18n/en.json" "$TMP_DIR/res/i18n/en.json"
    cp "$TMP_DIR/res/i18n/en.json" "$APP_DIR/res/i18n/en.json"

    for loc in $REMOTE_LOCALES; do
        download "${BASE_URL}/res/i18n/crowdin/${loc}.json" "$TMP_DIR/res/i18n/crowdin/${loc}.json"
        cp "$TMP_DIR/res/i18n/crowdin/${loc}.json" "$APP_DIR/res/i18n/crowdin/${loc}.json"
    done

    # --- 汉化脚本 ---
    log "同步汉化脚本..."
    for f in chs.js chscore.js kf.js kf.css; do
        download "${BASE_URL}/chs/${f}" "$TMP_DIR/chs/${f}"
        cp "$TMP_DIR/chs/${f}" "$APP_DIR/chs/${f}"
    done

    # --- 更新 REV_PARAM ---
    NEW_REV=$(grep -oP '"buildRevision"[^0-9]*\K[0-9]+' "$APP_DIR/build.version.json" 2>/dev/null || echo "0")
    sed -i "s/REV_PARAM=\"rev_=.*\"/REV_PARAM=\"rev_=${NEW_REV}\"/" "$0"

    # --- 更新本地 index.html 的模块列表 ---
    # 如果远程新增了模块，提示用户手动更新 index.html
    if [ -f "$TMP_DIR/remote_index.html" ]; then
        NEW_REMOTE=$(parse_modules "$TMP_DIR/remote_index.html")
        NEW_LOCAL=$(parse_modules "$APP_DIR/index.html")
        ADDED=$(diff_lists "$NEW_LOCAL" "$NEW_REMOTE")
        if [ -n "$ADDED" ]; then
            warn "远程新增了以下模块，请手动添加到 app/index.html 的 modules 数组中:"
            echo "$ADDED" | while read m; do info "  $m"; done
        fi
    fi

    log "✅ 同步完成！"
}

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ========================================================
#  入口
# ========================================================
case "${1:-}" in
    --check)
        analyze
        ;;
    --force)
        analyze || true
        sync_all
        ;;
    *)
        if analyze; then
            echo ""
            read -p "是否执行同步？(y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sync_all
            else
                log "已取消。"
            fi
        fi
        ;;
esac
