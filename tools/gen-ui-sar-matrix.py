#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 inventory 生成 UI SAR 矩阵（每控件 ≥1 happy + 全部 listed unhappy + 类型常识 unhappy）。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INV = ROOT / "docs" / "testing" / "UI-CONTROLS.inventory.json"
OUT_JSON = ROOT / "docs" / "testing" / "UI-SAR-MATRIX.json"
OUT_JS = ROOT / "test" / "system" / "ui-sar-matrix" / "cases.js"


def path_id(cid: str, kind: str, n: int, slug: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in slug)[:40]
    return f"{cid}--{kind}-{n}-{safe}".replace(".", "-")


def has_any(titles: list[str], *needles: str) -> bool:
    blob = " ".join(titles).lower()
    return any(n.lower() in blob for n in needles)


def add_unique(unhappy: list[str], title: str) -> None:
    if title not in unhappy:
        unhappy.append(title)


def enrich_unhappy(c: dict, unhappy: list[str]) -> None:
    """按类型/action/apis 常识补失败路径（不覆盖 inventory 已列项）。"""
    cid = c["controlId"]
    action = c.get("action") or ""
    et = c.get("elementType") or ""
    apis = c.get("apis") or []
    al = action.lower()
    cid_l = cid.lower()

    if "appConfirm" in action or "confirm" in al:
        if not has_any(unhappy, "cancel", "取消", "false"):
            add_unique(unhappy, "confirm 取消 → 状态不变")

    if "appPrompt" in action or "prompt" in al:
        if not has_any(unhappy, "cancel", "取消", "null"):
            add_unique(unhappy, "prompt 取消 → 无副作用")
        if not has_any(unhappy, "空名", "空"):
            add_unique(unhappy, "空名/空输入 → toast 或不建库")

    if et in ("input", "textarea"):
        if "search" in cid_l or "question" in cid_l or "answer" in cid_l or "fill" in cid_l or "count" in cid_l:
            if not has_any(unhappy, "空"):
                add_unique(unhappy, "空输入提交/确认 → 校验失败或不生效")

    # 文件选择：取消选文件（注意运算符优先级：and 两侧都是成员检查）
    if (
        "fileInput" in cid
        or "upload" in cid_l
        or ("import" in cid_l and "progress" in cid_l)
        or cid in ("settings.uploadLibrary", "settings.importProgressBtn", "drawer.importLibrary", "drawer.importProgress")
    ):
        if not has_any(unhappy, "取消选", "取消选文件", "取消"):
            add_unique(unhappy, "取消选文件 → 无导入")

    # 无库 / 不可达
    if cid.startswith(("bottombar.", "card.", "browse.practice", "settings.reset", "settings.export")):
        if not has_any(unhappy, "无库", "无当前", "隐藏", "不可达"):
            add_unique(unhappy, "无库/不可达态 → 隐藏或无副作用")

    if cid.startswith("drawer.libRow") or cid.startswith("home.libRow"):
        if not has_any(unhappy, "空"):
            add_unique(unhappy, "空库列表 → 无行可点")

    # API 失败路径
    api_touch = any(
        x in "".join(apis) or x in action
        for x in (
            "ProgressAPI",
            "LibraryAPI",
            "QuestionAPI",
            "IOAPI",
            "DrillAPI",
            "WrongBookAPI",
            "NavigationAPI",
        )
    )
    if api_touch and et in ("button", "input", "modal"):
        if not has_any(unhappy, "!ok", "fail", "失败", "API"):
            # 导航类纯 Router 不强制；有写状态 API 的控件补失败
            if any(x in action or x in "".join(apis) for x in ("reset", "delete", "export", "import", "answer", "add", "update", "start", "switch", "setStatus", "markMastered")):
                add_unique(unhappy, "API !ok → toast 或无副作用")

    # 导出类
    if "export" in cid_l or "download" in cid_l:
        if not has_any(unhappy, "fail", "失败", "!ok"):
            add_unique(unhappy, "导出/下载失败 → toast 且 domain 不变")

    # 列表行 / 动态行
    if "libRow" in cid or "questionRow" in cid or "categoryHeader" in cid:
        if not has_any(unhappy, "空", "无行", "fail"):
            add_unique(unhappy, "空列表或目标不可用 → 无副作用")

    # 练习面板关闭类已有 cancel；补无库
    if cid.startswith("browse.") and et == "button" and not has_any(unhappy, "无库", "不可达", "空", "cancel", "取消", "disabled", "隐藏"):
        if cid not in ("browse.backStudy", "browse.addQuestion", "browse.empty.goHome"):
            add_unique(unhappy, "无库/空目录 → 控件隐藏或点击无副作用")

    # 手势：多指 / 编辑焦点（inventory 可能已列）
    if et == "gesture" and "swipe" in cid_l:
        if not has_any(unhappy, "多指"):
            add_unique(unhappy, "多指触摸 → 忽略")
    if et == "gesture" and "keyboard" in cid_l:
        if not has_any(unhappy, "input", "textarea", "焦点", "忽略"):
            add_unique(unhappy, "input/textarea 焦点时忽略方向键")

    # 主题/模式：重复点仍一致
    if cid in ("settings.theme", "settings.mode"):
        if not has_any(unhappy, "重复"):
            add_unique(unhappy, "重复切换同一值 → 无异常副作用")

    # toast / download 反馈面
    if cid == "toast.surface":
        if not has_any(unhappy, "空"):
            add_unique(unhappy, "无 toast 时 surface 不误显")
    if cid == "download.triggerBlobDownload":
        if not has_any(unhappy, "失败", "cancel", "取消"):
            add_unique(unhappy, "下载钩子失败/取消 → 不改 domain")

    # confirm/prompt 模态本身
    if cid == "confirm.appConfirm" and not has_any(unhappy, "false", "取消"):
        add_unique(unhappy, "返回 false → 调用方中止")
    if cid == "prompt.appPrompt" and not has_any(unhappy, "null", "取消"):
        add_unique(unhappy, "返回 null → 调用方无副作用")

    # addq 选项边界
    if cid == "addq.optionRemove" and not has_any(unhappy, "≤2", "2"):
        add_unique(unhappy, "≤2 选项 → toast 不删")
    if cid == "addq.addOption" and not has_any(unhappy, "≥8", "8", "隐藏"):
        add_unique(unhappy, "≥8 选项 → 添加入口隐藏")

    # 壳层抽屉导航：无库时部分仍可点
    if cid.startswith("drawer.") and "navigate" in al and cid not in ("drawer.close",):
        if not has_any(unhappy, "无库", "不可达") and "reset" not in cid_l and "create" not in cid_l:
            add_unique(unhappy, "无库态仍可导航或按钮禁用（按实现）")


def main() -> None:
    inv = json.loads(INV.read_text(encoding="utf-8"))
    cases: list[dict] = []

    for c in inv["controls"]:
        cid = c["controlId"]
        happy = list(c.get("paths", {}).get("happy") or [])
        unhappy = list(c.get("paths", {}).get("unhappy") or [])
        if not happy:
            happy = [f"{c.get('label') or cid} 主成功路径"]

        enrich_unhappy(c, unhappy)

        # 仍无 unhappy 的交互控件：补一条「不可达」占位，保证 SAR 双侧
        et = c.get("elementType") or ""
        if not unhappy and et in ("button", "input", "textarea", "gesture", "modal", "chip"):
            add_unique(unhappy, "不可达/禁用/空态 → 无副作用")

        n = 0
        for title in happy:
            n += 1
            cases.append(
                {
                    "id": path_id(cid, "happy", n, title),
                    "controlId": cid,
                    "kind": "happy",
                    "title": title,
                    "page": c.get("page"),
                    "route": c.get("route"),
                    "elementType": c.get("elementType"),
                    "affectsProgressText": c.get("affectsProgressText"),
                    "selectors": c.get("selectors") or {},
                    "action": c.get("action") or "",
                    "status": "pending",
                }
            )
        for title in unhappy:
            n += 1
            cases.append(
                {
                    "id": path_id(cid, "unhappy", n, title),
                    "controlId": cid,
                    "kind": "unhappy",
                    "title": title,
                    "page": c.get("page"),
                    "route": c.get("route"),
                    "elementType": c.get("elementType"),
                    "affectsProgressText": c.get("affectsProgressText"),
                    "selectors": c.get("selectors") or {},
                    "action": c.get("action") or "",
                    "status": "pending",
                }
            )

    doc = {
        "schemaVersion": "1.0.0",
        "title": "UI SAR 全量矩阵（系统差分目标集）",
        "source": "docs/testing/UI-CONTROLS.inventory.json",
        "stats": {
            "controlCount": len(inv["controls"]),
            "caseCount": len(cases),
            "happy": sum(1 for x in cases if x["kind"] == "happy"),
            "unhappy": sum(1 for x in cases if x["kind"] == "unhappy"),
        },
        "cases": cases,
        "coverageRule": "每个 controlId 至少 1 happy；inventory/类型常识列出的 unhappy 全进矩阵；系统测 runner 必须对 executable 条做状态差分断言",
        "deferredPolicy": "实在无法在 jsdom/无头环境稳定复现的路径（如多指触摸、IME composition）列入 perform.js DEFERRED；matrix.test 仅对这些 id 使用 it.skip，数量应 ≤15",
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(
        "/** Auto-generated by tools/gen-ui-sar-matrix.py — do not hand-edit */\n"
        + "export const SAR_MATRIX = "
        + json.dumps(doc, ensure_ascii=False, indent=2)
        + ";\n"
        + "export const SAR_CASES = SAR_MATRIX.cases;\n",
        encoding="utf-8",
    )
    print(
        f"wrote {OUT_JSON} cases={len(cases)} happy={doc['stats']['happy']} unhappy={doc['stats']['unhappy']}"
    )
    print(f"wrote {OUT_JS}")
    if len(cases) < 220:
        raise SystemExit(f"caseCount={len(cases)} < 220，请继续补类型常识 unhappy")


if __name__ == "__main__":
    main()
