# -*- coding: utf-8 -*-
"""通用示例工程生成器：设计器模型（浏览器+按钮网格+4结果标签）+ 元数据文件。
用法：python _gen_episode.py <spec.json>
spec.json: {dir, id, title, buttons:[{id,name,content,row,col,event,bg}], pageH, resultY?}
"""
import io, json, os, sys

spec = json.load(io.open(sys.argv[1], encoding='utf-8'))
base = spec['dir']
proj = spec['id']
BTN_BG = {'blue': '#2563EB', 'teal': '#0F766E', 'violet': '#7C3AED', 'gray': '#475569', 'red': '#B91C1C'}

def label(id, name, content, x, y, w, h, bg, fg):
    return {"id": id, "type": "Label", "name": name, "content": content, "x": x, "y": y,
            "width": w, "height": h, "fontSize": 12, "fontFamily": "Microsoft YaHei UI",
            "background": bg, "foreground": fg, "isEnabled": True, "visibility": "Visible",
            "properties": {"staticStyle": "text", "textAlign": "left"},
            "fontBold": False, "fontItalic": False, "fontUnderline": False, "events": {}}

def button(id, name, content, x, y, bg, event):
    return {"id": id, "type": "Button", "name": name, "content": content, "x": x, "y": y,
            "width": 178, "height": 38, "fontSize": 12, "fontFamily": "Microsoft YaHei UI",
            "background": BTN_BG.get(bg, bg), "foreground": "#FFFFFF", "isEnabled": True,
            "visibility": "Visible", "properties": {"buttonStyle": "push", "cornerRadius": 6},
            "events": {"Click": event}, "fontBold": False, "fontItalic": False, "fontUnderline": False}

page_h = spec.get('pageH', 840)
controls = [
    label('title', '标题', spec['title'], 24, 16, 1100, 32, 'transparent', '#F9FAFB'),
    label('status', '运行状态', '等待操作……', 24, 56, 1252, 60, '#1E3A8A', '#DBEAFE'),
    {"id": "edge", "type": "EdgeBrowser", "name": "浏览器控件", "content": "Edge 浏览器",
     "x": 24, "y": 132, "width": 860, "height": page_h - 172, "fontSize": 12,
     "fontFamily": "Microsoft YaHei UI", "background": "#FFFFFF", "foreground": "#111827",
     "isEnabled": True, "visibility": "Visible", "properties": {}, "fontBold": False,
     "fontItalic": False, "fontUnderline": False, "events": {}},
]
for b in spec['buttons']:
    x = 908 if b.get('col', 0) == 0 else 1098
    y = 132 + 50 * b['row']
    controls.append(button(b['id'], b['name'], b['content'], x, y, b.get('bg', 'blue'), b['event']))
ry = 132 + 50 * (max(b['row'] for b in spec['buttons']) + 2)
colors = ['#A5F3FC', '#BBF7D0', '#FDE68A', '#FECACA']
for i in range(4):
    controls.append(label('result%d' % (i + 1), '结果标签%d' % (i + 1), '结果 %d：' % (i + 1),
                          908, ry + i * 66, 368, 62, '#0F172A', colors[i]))

window = {
    "id": "main-window", "fileName": "MainWindow.xml", "className": "MainWindow",
    "title": spec['title'], "width": 1320, "height": page_h, "background": "#111827",
    "designerBackend": "win32", "openPlacement": "center",
    "description": spec['title'], "events": {"Loaded": "_MainWindow_创建完毕"},
    "controls": controls, "resources": []
}
model = {"schemaVersion": 2, "id": proj, "name": spec['title'], "windows": [window]}
os.makedirs(os.path.join(base, '.lingbuilder', 'projects', proj), exist_ok=True)
os.makedirs(os.path.join(base, 'src'), exist_ok=True)
os.makedirs(os.path.join(base, 'assets'), exist_ok=True)
os.makedirs(os.path.join(base, 'config'), exist_ok=True)
json.dump(model, open(os.path.join(base, '.lingbuilder', 'projects', proj, 'window-designer.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
sol = {"schemaVersion": 2, "id": proj + "-solution", "name": spec['title'], "startupProjectId": proj,
       "startupProjectIds": [proj], "folders": [],
       "projects": [{"type": "visual-cpp", "id": proj, "name": spec['title'], "sourceRoot": "src",
                     "configRoot": "config", "designerPath": ".lingbuilder/projects/%s/window-designer.json" % proj,
                     "isDefault": True, "references": []}]}
json.dump(sol, open(os.path.join(base, '.lingbuilder', 'solution.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
mods = {"schemaVersion": 1, "enabledModuleIds": ["lingbuilder.win32.basic", "lingbuilder.edgeview", "lingbuilder.fs.path"],
        "pinnedVersions": {"lingbuilder.win32.basic": "1.0.0", "lingbuilder.edgeview": "1.5.1", "lingbuilder.fs.path": "1.0.0"}}
json.dump(mods, open(os.path.join(base, '.lingbuilder', 'projects', proj, 'project-modules.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
lbs = {"schemaVersion": 1, "kind": "lingbuilder-solution", "id": proj + "-solution", "name": spec['title'],
       "solutionFile": ".lingbuilder/solution.json", "startupProjectId": proj, "startupProjectIds": [proj],
       "folders": [], "projects": [{"id": proj, "name": spec['title'], "type": "visual-cpp", "sourceRoot": "src", "references": []}]}
json.dump(lbs, open(os.path.join(base, spec.get('lbsln', 'EdgeView示例.lbsln')), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
req = {'project': model, 'activeWindowId': 'main-window', 'run': False, 'approved': True}
json.dump(req, open(os.path.join(base, 'build-request.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('generated:', proj, 'buttons:', len(spec['buttons']))
