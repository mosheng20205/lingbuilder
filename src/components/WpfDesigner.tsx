import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutGrid, 
  Wrench, 
  Trash2, 
  Plus, 
  Copy, 
  Check, 
  Settings, 
  MousePointer, 
  FileCode, 
  HelpCircle, 
  Sparkles, 
  Layers, 
  Palette, 
  Maximize2,
  FileText,
  Zap
} from 'lucide-react';
import ModuleInspector from './ModuleInspector';

// WPF control interface
interface WpfControl {
  id: string;
  type: 'Button' | 'TextBox' | 'Label' | 'CheckBox' | 'RadioButton' | 'Image' | 'ProgressBar' | 'ComboBox' | 'Grid';
  name: string;
  content: string;
  width: number;
  height: number;
  x: number;
  y: number;
  fontSize: number;
  background: string;
  foreground: string;
  isEnabled: boolean;
  visibility: 'Visible' | 'Collapsed';
  events?: {
    [eventName: string]: string;
  };
}

// Preset layouts
type LayoutPreset = 'launcher' | 'login' | 'about';

const getEventsForType = (type: WpfControl['type']): { name: string; label: string; desc: string }[] => {
  switch (type) {
    case 'Button':
      return [
        { name: 'Click', label: '单击事件 (Click)', desc: '鼠标左键点击按钮时触发' },
        { name: 'MouseEnter', label: '鼠标移入 (MouseEnter)', desc: '鼠标指针移入按钮边界时触发' },
        { name: 'MouseLeave', label: '鼠标移出 (MouseLeave)', desc: '鼠标指针离开按钮边界时触发' }
      ];
    case 'TextBox':
      return [
        { name: 'TextChanged', label: '文本改变 (TextChanged)', desc: '文本框内字符内容发生变化时触发' },
        { name: 'GotFocus', label: '获得焦点 (GotFocus)', desc: '输入光标进入文本框时触发' },
        { name: 'LostFocus', label: '失去焦点 (LostFocus)', desc: '输入光标离开文本框时触发' }
      ];
    case 'CheckBox':
    case 'RadioButton':
      return [
        { name: 'Checked', label: '选中事件 (Checked)', desc: '控件被勾选或选中时触发' },
        { name: 'Unchecked', label: '取消选中 (Unchecked)', desc: '控件被取消勾选时触发' }
      ];
    case 'ComboBox':
      return [
        { name: 'SelectionChanged', label: '选择改变 (SelectionChanged)', desc: '下拉选择框的当前选中项改变时触发' }
      ];
    case 'ProgressBar':
      return [
        { name: 'ValueChanged', label: '数值改变 (ValueChanged)', desc: '进度条的进度当前值发生改变时触发' }
      ];
    default:
      return [
        { name: 'MouseDown', label: '鼠标按下 (MouseDown)', desc: '鼠标在该元素上按下时触发' },
        { name: 'Loaded', label: '加载完成 (Loaded)', desc: '控件在界面上初始化渲染加载完毕时触发' }
      ];
  }
};

export default function WpfDesigner({ isDarkMode }: { isDarkMode: boolean }) {
  // Preset Templates Data
  const initialLauncherControls: WpfControl[] = [
    {
      id: 'lbl_title',
      type: 'Label',
      name: '游戏标题标签',
      content: '太空冒险 (Space Adventure) 客户端',
      width: 500,
      height: 40,
      x: 40,
      y: 30,
      fontSize: 22,
      background: 'transparent',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_version',
      type: 'Label',
      name: '版本文本',
      content: '核心版本: v2.0.4.12 (C++ UTF-8 本地化版)',
      width: 320,
      height: 25,
      x: 40,
      y: 75,
      fontSize: 12,
      background: 'transparent',
      foreground: '#888899',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_status',
      type: 'Label',
      name: '服务器状态标签',
      content: '● 太空服务器状态：正常联机已就绪 (已启用中文映射编译环境)',
      width: 450,
      height: 25,
      x: 40,
      y: 105,
      fontSize: 13,
      background: 'transparent',
      foreground: '#73C991',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_name_hint',
      type: 'Label',
      name: '角色昵称提示标签',
      content: '请输入您的星际领航员昵称：',
      width: 250,
      height: 20,
      x: 40,
      y: 145,
      fontSize: 12,
      background: 'transparent',
      foreground: '#CCCCCC',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'txt_username',
      type: 'TextBox',
      name: '玩家昵称输入框',
      content: '星际探索者_零号',
      width: 280,
      height: 34,
      x: 40,
      y: 170,
      fontSize: 13,
      background: '#2D2D30',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible',
      events: { TextChanged: '玩家昵称_TextChanged' }
    },
    {
      id: 'btn_launch',
      type: 'Button',
      name: '开始游戏按钮',
      content: '进入太空冒险 (编译并启动)',
      width: 200,
      height: 42,
      x: 40,
      y: 220,
      fontSize: 14,
      background: '#007ACC',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible',
      events: { Click: '开始游戏按钮_Click' }
    },
    {
      id: 'btn_exit',
      type: 'Button',
      name: '退出客户端按钮',
      content: '关闭客户端',
      width: 120,
      height: 42,
      x: 255,
      y: 220,
      fontSize: 14,
      background: '#3E3E40',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible',
      events: { Click: '退出客户端按钮_Click' }
    },
    {
      id: 'chk_remember',
      type: 'CheckBox',
      name: '记住密码复选框',
      content: '保存当前登录配置与中文代码方案',
      width: 300,
      height: 22,
      x: 40,
      y: 280,
      fontSize: 12,
      background: 'transparent',
      foreground: '#CCCCCC',
      isEnabled: true,
      visibility: 'Visible',
      events: { Checked: '记住配置_Checked' }
    },
    {
      id: 'lbl_progress_hint',
      type: 'Label',
      name: '状态进度提示文本',
      content: '正在同步星图轨道资源资产包... (已完成 35MB/100MB)',
      width: 450,
      height: 22,
      x: 40,
      y: 335,
      fontSize: 11,
      background: 'transparent',
      foreground: '#888888',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'progress_sync',
      type: 'ProgressBar',
      name: '资源同步进度条',
      content: '35', // progress value
      width: 620,
      height: 22,
      x: 40,
      y: 360,
      fontSize: 11,
      background: '#2D2D30',
      foreground: '#73C991',
      isEnabled: true,
      visibility: 'Visible'
    }
  ];

  const initialLoginControls: WpfControl[] = [
    {
      id: 'lbl_login_title',
      type: 'Label',
      name: '登录窗体标题',
      content: '太空冒险安全账户登录',
      width: 400,
      height: 35,
      x: 150,
      y: 40,
      fontSize: 18,
      background: 'transparent',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_account',
      type: 'Label',
      name: '账户标签',
      content: '登录账户 / 邮箱：',
      width: 150,
      height: 20,
      x: 100,
      y: 95,
      fontSize: 12,
      background: 'transparent',
      foreground: '#CCCCCC',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'txt_account',
      type: 'TextBox',
      name: '账户输入框',
      content: 'admin@space_adventure.com',
      width: 400,
      height: 35,
      x: 100,
      y: 120,
      fontSize: 13,
      background: '#2D2D30',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_password',
      type: 'Label',
      name: '密码标签',
      content: '登录安全密码：',
      width: 150,
      height: 20,
      x: 100,
      y: 170,
      fontSize: 12,
      background: 'transparent',
      foreground: '#CCCCCC',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'txt_password',
      type: 'TextBox',
      name: '密码输入框',
      content: '••••••••••••',
      width: 400,
      height: 35,
      x: 100,
      y: 195,
      fontSize: 13,
      background: '#2D2D30',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'chk_policy',
      type: 'CheckBox',
      name: '许可协议复选框',
      content: '我已经仔细阅读并同意《太空冒险星际用户公约》',
      width: 350,
      height: 22,
      x: 100,
      y: 250,
      fontSize: 12,
      background: 'transparent',
      foreground: '#AAAAAA',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'btn_submit',
      type: 'Button',
      name: '提交登录按钮',
      content: '立即安全登录账户',
      width: 400,
      height: 42,
      x: 100,
      y: 295,
      fontSize: 14,
      background: '#2e7d32',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    }
  ];

  const initialAboutControls: WpfControl[] = [
    {
      id: 'lbl_about_app',
      type: 'Label',
      name: '程序说明标题',
      content: 'Space Adventure UI 核心管理器',
      width: 350,
      height: 25,
      x: 50,
      y: 40,
      fontSize: 16,
      background: 'transparent',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_copyright',
      type: 'Label',
      name: '版权说明文本',
      content: '版权所有 (C) 2026 Space Dev. 保留所有权利。',
      width: 350,
      height: 20,
      x: 50,
      y: 70,
      fontSize: 11,
      background: 'transparent',
      foreground: '#888888',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'lbl_about_desc',
      type: 'Label',
      name: '多行关于描述',
      content: '本工具是基于可视化 UI 架构自主设计的 C++ 中文编程与组件渲染系统。可在无英文配置的前提下，通过智能映射和代码生成，瞬间输出包含中文类、属性及控制变量的完整原生 C++ 类定义。',
      width: 400,
      height: 100,
      x: 50,
      y: 110,
      fontSize: 12,
      background: 'transparent',
      foreground: '#CCCCCC',
      isEnabled: true,
      visibility: 'Visible'
    },
    {
      id: 'btn_confirm',
      type: 'Button',
      name: '确认退出框按钮',
      content: '我知道了',
      width: 100,
      height: 35,
      x: 350,
      y: 230,
      fontSize: 12,
      background: '#007ACC',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    }
  ];

  // States
  const [controls, setControls] = useState<WpfControl[]>(initialLauncherControls);
  const [selectedControlId, setSelectedControlId] = useState<string | null>('btn_launch');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'properties' | 'events' | 'modules'>('properties');
  const [activePreset, setActivePreset] = useState<LayoutPreset>('launcher');
  const [copiedText, setCopiedText] = useState<'xaml' | 'cpp' | null>(null);
  const [viewCodeType, setViewCodeType] = useState<'xaml' | 'cpp'>('xaml');

  // Dragging States
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Custom event listener to let the toolbar add controls
  useEffect(() => {
    const handleAddFromToolbar = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.type) {
        handleAddControl(customEvent.detail.type);
      }
    };
    window.addEventListener('add-designer-control', handleAddFromToolbar);
    return () => {
      window.removeEventListener('add-designer-control', handleAddFromToolbar);
    };
  }, [controls, selectedControlId]);

  // Selected control helper
  const selectedControl = controls.find(c => c.id === selectedControlId) || null;

  // Load Presets
  const handleLoadPreset = (preset: LayoutPreset) => {
    setActivePreset(preset);
    setSelectedControlId(null);
    if (preset === 'launcher') {
      setControls(initialLauncherControls);
      setSelectedControlId('btn_launch');
    } else if (preset === 'login') {
      setControls(initialLoginControls);
      setSelectedControlId('btn_submit');
    } else if (preset === 'about') {
      setControls(initialAboutControls);
      setSelectedControlId('btn_confirm');
    }
  };

  // Update properties of selected control
  const updateSelectedControl = (updatedFields: Partial<WpfControl>) => {
    if (!selectedControlId) return;
    setControls(prev => prev.map(c => {
      if (c.id === selectedControlId) {
        return { ...c, ...updatedFields };
      }
      return c;
    }));
  };

  // Add control
  const handleAddControl = (type: WpfControl['type']) => {
    const typeLabelMap: Record<WpfControl['type'], string> = {
      Button: '按钮',
      TextBox: '输入框',
      Label: '文本标签',
      CheckBox: '复选框',
      RadioButton: '单选按钮',
      Image: '图片控件',
      ProgressBar: '进度条',
      ComboBox: '下拉菜单',
      Grid: '网格容器'
    };

    const typeDefaultContentMap: Record<WpfControl['type'], string> = {
      Button: '新按钮',
      TextBox: '请输入内容...',
      Label: '新文本标签',
      CheckBox: '选项复选框',
      RadioButton: '单选选项',
      Image: '【星际图形素材】',
      ProgressBar: '50',
      ComboBox: '选择项_A',
      Grid: ''
    };

    const newId = `${type.toLowerCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const newControl: WpfControl = {
      id: newId,
      type,
      name: `${typeLabelMap[type]}_${controls.length + 1}`,
      content: typeDefaultContentMap[type],
      width: type === 'ProgressBar' ? 300 : type === 'Label' ? 180 : 120,
      height: type === 'ProgressBar' ? 20 : type === 'TextBox' ? 34 : 35,
      x: 180 + Math.floor(Math.random() * 50),
      y: 150 + Math.floor(Math.random() * 50),
      fontSize: 12,
      background: type === 'Button' ? '#007ACC' : type === 'TextBox' ? '#2D2D30' : 'transparent',
      foreground: '#FFFFFF',
      isEnabled: true,
      visibility: 'Visible'
    };

    setControls(prev => [...prev, newControl]);
    setSelectedControlId(newId);
  };

  // Delete selected control
  const handleDeleteControl = () => {
    if (!selectedControlId) return;
    setControls(prev => prev.filter(c => c.id !== selectedControlId));
    setSelectedControlId(null);
  };

  // Mouse drag handles
  const handleMouseDown = (e: React.MouseEvent, control: WpfControl, action: 'drag' | 'resize') => {
    e.stopPropagation();
    setSelectedControlId(control.id);

    if (action === 'drag') {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - control.x,
        y: e.clientY - control.y
      });
    } else if (action === 'resize') {
      setIsResizing(true);
      setInitialSize({ width: control.width, height: control.height });
      setInitialPos({ x: e.clientX, y: e.clientY });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!selectedControlId) return;

      if (isDragging) {
        const newX = Math.max(0, Math.min(680 - (selectedControl?.width || 50), e.clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(420 - (selectedControl?.height || 20), e.clientY - dragOffset.y));
        
        // Snapping logic (5px grid align)
        const snapX = Math.round(newX / 5) * 5;
        const snapY = Math.round(newY / 5) * 5;

        updateSelectedControl({ x: snapX, y: snapY });
      } else if (isResizing && selectedControl) {
        const deltaX = e.clientX - initialPos.x;
        const deltaY = e.clientY - initialPos.y;

        const newWidth = Math.max(20, Math.min(680 - selectedControl.x, initialSize.width + deltaX));
        const newHeight = Math.max(15, Math.min(420 - selectedControl.y, initialSize.height + deltaY));

        const snapWidth = Math.round(newWidth / 5) * 5;
        const snapHeight = Math.round(newHeight / 5) * 5;

        updateSelectedControl({ width: snapWidth, height: snapHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, selectedControlId, dragOffset, initialSize, initialPos, selectedControl]);

  // Copy code utility
  const handleCopyCode = (text: string, type: 'xaml' | 'cpp') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Real-time pure Chinese XML generation
  const generateXAML = (): string => {
    let xml = `<!-- 可视化中文界面布局结构定义 (MainWindow.xml) -->\n`;
    xml += `<主窗口 名称="游戏主窗口" 标题="太空冒险游戏客户端" 宽度="700" 高度="420" 背景颜色="#1E1E24" 控件对齐="绝对坐标">\n`;
    xml += `    <网格布局 容器边距="0">\n`;
    
    controls.forEach(c => {
      const visibilityAttr = c.visibility === 'Collapsed' ? ' 可见性="隐藏"' : '';
      const stateAttr = !c.isEnabled ? ' 启用状态="禁用"' : '';
      const styleAttr = c.background !== 'transparent' ? ` 背景色="${c.background}"` : '';
      
      // Generate events attributes like 单击="按钮_Click"
      let eventAttrs = '';
      if (c.events) {
        Object.entries(c.events).forEach(([evName, handler]) => {
          if (handler) {
            let chEventName = evName;
            if (evName === 'Click') chEventName = '单击';
            else if (evName === 'TextChanged') chEventName = '文本改变';
            else if (evName === 'Checked') chEventName = '选中';
            else if (evName === 'Unchecked') chEventName = '取消选中';
            else if (evName === 'SelectionChanged') chEventName = '选中项改变';
            else if (evName === 'ValueChanged') chEventName = '数值改变';
            else if (evName === 'MouseEnter') chEventName = '鼠标移入';
            else if (evName === 'MouseLeave') chEventName = '鼠标移出';
            else if (evName === 'MouseDown') chEventName = '鼠标按下';
            else if (evName === 'Loaded') chEventName = '加载完成';
            eventAttrs += ` ${chEventName}="${handler}"`;
          }
        });
      }

      switch (c.type) {
        case 'Button':
          xml += `        <中文按钮 名称="${c.name}" 内容="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 字体大小="${c.fontSize}"${styleAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
          break;
        case 'TextBox':
          xml += `        <中文输入框 名称="${c.name}" 默认文本="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 字体大小="${c.fontSize}"${styleAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
          break;
        case 'Label':
          xml += `        <中文标签 名称="${c.name}" 内容="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 字体大小="${c.fontSize}" 字体颜色="${c.foreground}"${visibilityAttr}${eventAttrs} />\n`;
          break;
        case 'CheckBox':
          xml += `        <中文复选框 名称="${c.name}" 内容="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 默认选中="否" 字体大小="${c.fontSize}"${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
          break;
        case 'RadioButton':
          xml += `        <中文单选框 名称="${c.name}" 内容="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 默认选中="否" 字体大小="${c.fontSize}"${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
          break;
        case 'ProgressBar':
          xml += `        <中文进度条 名称="${c.name}" 当前值="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 进度条颜色="${c.foreground}"${visibilityAttr}${eventAttrs} />\n`;
          break;
        case 'ComboBox':
          xml += `        <中文下拉框 名称="${c.name}" 默认选中项="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}"${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
          break;
        case 'Image':
          xml += `        <中文图片 名称="${c.name}" 图片源="${c.content}" 宽度="${c.width}" 高度="${c.height}" 坐标="${c.x},${c.y}" 填充模式="等比例拉伸"${visibilityAttr}${eventAttrs} />\n`;
          break;
      }
    });

    xml += `    </网格布局>\n`;
    xml += `</主窗口>`;
    return xml;
  };

  // Real-time pure Chinese mapped C++ code generation (differentiator!)
  const generateCppCode = (): string => {
    let cpp = `// =========================================================\n`;
    cpp += `// 自动生成的中文 C++ 界面逻辑及类型映射类定义 (MainWindow.h)\n`;
    cpp += `// =========================================================\n`;
    cpp += `#pragma once\n\n`;
    cpp += `// 引用底层汉化 C++ 库定义封装\n`;
    cpp += `#include "中文UI运行支持库.h"\n\n`;
    cpp += `类 游戏主窗体 : 公开 窗体 {\n`;
    cpp += `私有:\n`;
    cpp += `    // 可视化设计器自动提取的中文控件映射成员：\n`;

    controls.forEach(c => {
      let typeStr = '控件*';
      if (c.type === 'Button') typeStr = '中文按钮*';
      else if (c.type === 'TextBox') typeStr = '中文文本输入框*';
      else if (c.type === 'Label') typeStr = '中文文本标签*';
      else if (c.type === 'CheckBox') typeStr = '中文复选框*';
      else if (c.type === 'RadioButton') typeStr = '中文单选框*';
      else if (c.type === 'ProgressBar') typeStr = '中文进度条*';
      else if (c.type === 'ComboBox') typeStr = '中文下拉选择框*';
      else if (c.type === 'Image') typeStr = '中文图片框*';

      cpp += `    ${typeStr.padEnd(16)} ${c.name};\n`;
    });

    cpp += `\n公开:\n`;
    cpp += `    // 构造函数\n`;
    cpp += `    游戏主窗体() {\n`;
    cpp += `        // 初始化窗体自身属性\n`;
    cpp += `        主窗体->设置标题(L"太空冒险游戏客户端 (中文界面映射)");\n`;
    cpp += `        主窗体->设置宽度(700);\n`;
    cpp += `        主窗体->设置高度(420);\n`;
    cpp += `        主窗体->设置背景画刷(十六进制画刷::从代码("#1E1E24"));\n\n`;
    cpp += `        // 顺序装载并实例化可视化设计器生成的控件\n`;

    controls.forEach(c => {
      let classNew = '新 中文按钮';
      if (c.type === 'Button') classNew = '新 中文按钮';
      else if (c.type === 'TextBox') classNew = '新 中文文本输入框';
      else if (c.type === 'Label') classNew = '新 中文文本标签';
      else if (c.type === 'CheckBox') classNew = '新 中文复选框';
      else if (c.type === 'RadioButton') classNew = '新 中文单选框';
      else if (c.type === 'ProgressBar') classNew = '新 中文进度条';
      else if (c.type === 'ComboBox') classNew = '新 中文下拉选择框';
      else if (c.type === 'Image') classNew = '新 中文图片框';

      cpp += `        // 映射控件: ${c.name}\n`;
      cpp += `        ${c.name} = ${classNew}();\n`;
      if (c.type === 'ProgressBar') {
        cpp += `        ${c.name}->设置当前进度(${c.content});\n`;
      } else if (c.type !== 'Grid') {
        cpp += `        ${c.name}->设置内容文本(L"${c.content}");\n`;
      }
      cpp += `        ${c.name}->设置控件宽度(${c.width});\n`;
      cpp += `        ${c.name}->设置控件高度(${c.height});\n`;
      cpp += `        ${c.name}->设置视口位置(${c.x}, ${c.y});\n`;
      cpp += `        ${c.name}->设置字体字号(${c.fontSize});\n`;
      if (c.background !== 'transparent') {
        cpp += `        ${c.name}->设置背景颜色(十六进制画刷::从代码("${c.background}"));\n`;
      }
      if (!c.isEnabled) {
        cpp += `        ${c.name}->设置为禁用状态(真);\n`;
      }
      if (c.visibility === 'Collapsed') {
        cpp += `        ${c.name}->设置可见状态(假);\n`;
      }
      cpp += `        主窗体->子控件集合->添加(${c.name});\n\n`;
    });

    cpp += `        // 注册事件回调处理器\n`;
    controls.forEach(c => {
      if (c.events) {
        Object.entries(c.events).forEach(([evName, handler]) => {
          if (handler) {
            let chEventName = evName;
            if (evName === 'Click') chEventName = '单击';
            else if (evName === 'TextChanged') chEventName = '文本内容改变';
            else if (evName === 'Checked') chEventName = '被勾选';
            else if (evName === 'Unchecked') chEventName = '取消勾选';
            else if (evName === 'SelectionChanged') chEventName = '下拉项改变';
            else if (evName === 'ValueChanged') chEventName = '数值变化';
            else if (evName === 'MouseEnter') chEventName = '指针移入';
            else if (evName === 'MouseLeave') chEventName = '指针移出';
            else if (evName === 'MouseDown') chEventName = '鼠标按下';
            else if (evName === 'Loaded') chEventName = '初始化加载';

            cpp += `        ${c.name}->${chEventName}事件 += [本指针](对象* 发送方, 路由参数* 参数) {\n`;
            cpp += `            本指针->${handler}(发送方, 参数);\n`;
            cpp += `        };\n`;
          }
        });
      }
    });

    cpp += `    }\n\n`;
    cpp += `    // 析构函数，安全释放中文资源指针\n`;
    cpp += `    ~游戏主窗体() {\n`;
    controls.forEach(c => {
      cpp += `        安全删除(this->${c.name});\n`;
    });
    cpp += `    }\n\n`;

    cpp += `    // =========================================================\n`;
    cpp += `    // 后台事件处理器 (Event Handlers):\n`;
    cpp += `    // =========================================================\n`;
    let handlerCount = 0;
    controls.forEach(c => {
      if (c.events) {
        Object.entries(c.events).forEach(([evName, handler]) => {
          if (handler) {
            handlerCount++;
            cpp += `    空 ${handler}(对象* 发送方, 路由参数* 参数) {\n`;
            cpp += `        // ${c.name} 的 ${evName} 事件响应\n`;
            cpp += `        // 在此编写您的 C++ 中文逻辑，例如控制其他控件：\n`;
            if (c.type === 'Button') {
              cpp += `        弹窗消息::弹出提示(L"事件响应成功：已触发【${c.name}】的 ${evName} 回调！");\n`;
            } else if (c.type === 'TextBox') {
              cpp += `        // 当文本框内文字改变时执行\n`;
              cpp += `        文字调试区::输出行(L"【${c.name}】内容更新...");\n`;
            } else {
              cpp += `        // 执行默认本地逻辑\n`;
            }
            cpp += `    }\n\n`;
          }
        });
      }
    });
    if (handlerCount === 0) {
      cpp += `    // 当前没有绑定任何事件处理器。您可以在右侧【属性视口->事件】中进行绑定。\n`;
    }

    cpp += `};`;

    return cpp;
  };

  const xamlCode = generateXAML();
  const cppCode = generateCppCode();

  return (
    <div className={`flex-1 flex flex-col overflow-hidden font-sans ${
      isDarkMode ? 'bg-[#141418]' : 'bg-white'
    }`}>
      {/* Designer Toolbar Header */}
      <div className={`flex items-center justify-between px-4 py-2 gap-3 shrink-0 select-none border-b ${
        isDarkMode ? 'bg-[#1a1a22] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded bg-amber-500 animate-pulse"></div>
          <span className={`text-xs font-bold flex items-center gap-1.5 ${
            isDarkMode ? 'text-slate-200' : 'text-slate-800'
          }`}>
            <LayoutGrid className="w-4 h-4 text-amber-500" />
            <span>可视化界面设计器 (基于 XML 驱动)</span>
          </span>
          <span className={`text-[10px] ml-2 px-1.5 py-0.2 rounded font-mono border ${
            isDarkMode 
              ? 'text-slate-500 border-slate-700/50' 
              : 'text-slate-500 border-slate-200 bg-slate-50'
          }`}>
            自主可控的 C++ 中文可视化界面工具箱
          </span>
        </div>

        {/* Preset Selector */}
        <div className={`flex items-center gap-1 p-0.5 rounded border ${
          isDarkMode ? 'bg-[#25252b] border-slate-700/40' : 'bg-slate-200/60 border-slate-300'
        }`}>
          <span className={`text-[10px] px-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>切换设计预设:</span>
          <button
            onClick={() => handleLoadPreset('launcher')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
              activePreset === 'launcher' 
                ? 'bg-amber-600/90 text-white shadow-sm' 
                : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            游戏启动器
          </button>
          <button
            onClick={() => handleLoadPreset('login')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
              activePreset === 'login' 
                ? 'bg-amber-600/90 text-white shadow-sm' 
                : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            安全登录窗口
          </button>
          <button
            onClick={() => handleLoadPreset('about')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
              activePreset === 'about' 
                ? 'bg-amber-600/90 text-white shadow-sm' 
                : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            "关于"说明框
          </button>
        </div>
      </div>

      {/* Main Designer Grid Work Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Controls Toolbox */}
        <div className={`w-56 flex flex-col shrink-0 select-none border-r ${
          isDarkMode ? 'bg-[#1a1a20] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`p-2.5 border-b flex items-center justify-between ${
            isDarkMode ? 'border-[#2d2d34] bg-[#22222a]/30' : 'border-slate-200 bg-slate-100/60'
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <Wrench className="w-3.5 h-3.5 text-blue-500" />
              <span>控件工具箱</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <p className={`text-[10px] px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>点击下列标准通用控件，即可将其中文映射实例化到中央设计画布：</p>
            
            <div className="grid grid-cols-1 gap-1">
              {(['Button', 'TextBox', 'Label', 'CheckBox', 'RadioButton', 'ProgressBar', 'ComboBox', 'Image'] as WpfControl['type'][]).map(type => {
                const typeLabels: Record<string, string> = {
                  Button: '按钮 (Button)',
                  TextBox: '文本框 (TextBox)',
                  Label: '标签 (Label)',
                  CheckBox: '复选框 (CheckBox)',
                  RadioButton: '单选框 (RadioButton)',
                  ProgressBar: '进度条 (ProgressBar)',
                  ComboBox: '下拉框 (ComboBox)',
                  Image: '图片 (Image)'
                };

                return (
                  <button
                    key={type}
                    onClick={() => handleAddControl(type)}
                    className={`flex items-center gap-2 px-2.5 py-2 text-left text-xs rounded border cursor-pointer transition-all ${
                      isDarkMode 
                        ? 'text-slate-300 hover:text-white border-transparent hover:border-[#3c3c44] hover:bg-[#25252b]/80' 
                        : 'text-slate-700 hover:text-slate-900 border-slate-200/50 bg-white hover:bg-slate-100/80 shadow-sm'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-emerald-500" />
                    <span>{typeLabels[type]}</span>
                  </button>
                );
              })}
            </div>

            <div className={`pt-4 border-t mt-4 ${isDarkMode ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <div className={`p-2 rounded text-[10px] leading-relaxed border ${
                isDarkMode 
                  ? 'bg-slate-900/40 border-slate-800 text-slate-400' 
                  : 'bg-amber-50/40 border-amber-200 text-slate-650'
              }`}>
                <span className="font-semibold text-amber-600 block mb-1 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-amber-500" />
                  提示与设计建议:
                </span>
                设计器基于矢量渲染。当您将这些控件拖入画布时，它们对应的中文命名、属性和内部 C++ 指针对象会进行自动多路映射绑定。
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Canvas Stage with Gridlines */}
        <div className={`flex-1 p-6 flex flex-col overflow-auto items-center justify-start relative select-none ${
          isDarkMode ? 'bg-[#101014]' : 'bg-slate-100/50'
        }`}>
          <div className="text-[10px] text-slate-500 font-mono mb-2 uppercase select-none w-full max-w-[702px] flex justify-between">
            <span>[MainWindow.xml - 渲染主视口 (700 x 420)]</span>
            <span>按住鼠标可在网格中拖拽或调整尺寸</span>
          </div>

          {/* Visual Canvas Card representing standard windows shell */}
          <div
            ref={canvasRef}
            id="wpf-design-canvas"
            className="w-[700px] h-[420px] bg-[#1E1E24] rounded-lg shadow-2xl relative border-2 border-slate-700/60 overflow-hidden shrink-0 select-none"
            style={{
              backgroundImage: `
                radial-gradient(circle, #33333e 1px, transparent 1px),
                radial-gradient(circle, #33333e 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px'
            }}
            onClick={() => setSelectedControlId(null)}
          >
            {/* Top window decorations bar (Chrome mock) */}
            <div className="h-7 bg-[#2D2D30] flex items-center justify-between px-3 text-slate-400 border-b border-slate-800 select-none">
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium text-slate-300">
                <span className="w-3.5 h-3.5 bg-amber-600/30 text-amber-400 rounded-sm text-[9px] flex items-center justify-center font-bold">G</span>
                <span>太空冒险主窗体 (MainWindow)</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span>—</span>
                <span>❑</span>
                <span>✕</span>
              </div>
            </div>

            {/* Rendered Controls */}
            {controls.map(c => {
              const isSelected = c.id === selectedControlId;
              const isCollapsed = c.visibility === 'Collapsed';

              return (
                <div
                  key={c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedControlId(c.id);
                  }}
                  onMouseDown={(e) => handleMouseDown(e, c, 'drag')}
                  className={`absolute group cursor-move select-none ${
                    isSelected ? 'ring-1 ring-amber-500 z-40' : 'hover:ring-1 hover:ring-slate-500 z-20'
                  } ${isCollapsed ? 'opacity-30 border border-dashed border-red-500' : ''}`}
                  style={{
                    left: `${c.x}px`,
                    top: `${c.y + 28}px`, // offset by window titlebar height (28px)
                    width: `${c.width}px`,
                    height: `${c.height}px`,
                  }}
                >
                {/* Sizing Guides - Dotted lines to window borders */}
                  {isSelected && (
                    <>
                      {/* Left border guide line */}
                      <div className="absolute top-1/2 -left-[1000px] right-full h-px border-t border-dashed border-amber-500/65 pointer-events-none z-50">
                        <span className="absolute -top-4 left-4 bg-slate-900/80 text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-mono shadow border border-amber-500/20">
                          左: {c.x}px
                        </span>
                      </div>
                      {/* Top border guide line */}
                      <div className="absolute left-1/2 -top-[1000px] bottom-full w-px border-l border-dashed border-amber-500/65 pointer-events-none z-50">
                        <span className="absolute left-2 top-4 bg-slate-900/80 text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-mono shadow border border-amber-500/20">
                          顶: {c.y}px
                        </span>
                      </div>
                      {/* Width & Height tag overlay */}
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-amber-500 text-slate-950 font-bold px-1 py-0.2 rounded text-[8px] font-mono shadow select-none pointer-events-none">
                        宽:{c.width} x 高:{c.height}
                      </div>
                    </>
                  )}

                  {/* Render control appearance by type */}
                  <div className="w-full h-full relative select-none pointer-events-none">
                    {c.type === 'Button' && (
                      <button
                        disabled={!c.isEnabled}
                        className="w-full h-full rounded text-center text-xs font-semibold shadow flex items-center justify-center transition-all px-2 select-none"
                        style={{
                          backgroundColor: c.background,
                          color: c.foreground,
                          fontSize: `${c.fontSize}px`,
                          opacity: c.isEnabled ? 1 : 0.5
                        }}
                      >
                        {c.content}
                      </button>
                    )}

                    {c.type === 'TextBox' && (
                      <div
                        className="w-full h-full rounded border border-slate-700 px-2 flex items-center justify-start text-xs select-none"
                        style={{
                          backgroundColor: c.background,
                          color: c.foreground,
                          fontSize: `${c.fontSize}px`,
                          opacity: c.isEnabled ? 1 : 0.5
                        }}
                      >
                        {c.content}
                      </div>
                    )}

                    {c.type === 'Label' && (
                      <div
                        className="w-full h-full flex items-center justify-start text-xs leading-normal select-none"
                        style={{
                          color: c.foreground,
                          fontSize: `${c.fontSize}px`,
                          backgroundColor: c.background,
                          fontWeight: c.fontSize > 14 ? 'bold' : 'normal'
                        }}
                      >
                        {c.content}
                      </div>
                    )}

                    {c.type === 'CheckBox' && (
                      <div className="w-full h-full flex items-center gap-2 text-xs select-none" style={{ color: c.foreground, fontSize: `${c.fontSize}px` }}>
                        <div className="w-3.5 h-3.5 border border-slate-500 rounded bg-slate-900 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                        <span className="truncate">{c.content}</span>
                      </div>
                    )}

                    {c.type === 'RadioButton' && (
                      <div className="w-full h-full flex items-center gap-2 text-xs select-none" style={{ color: c.foreground, fontSize: `${c.fontSize}px` }}>
                        <div className="w-3.5 h-3.5 border border-slate-500 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                        </div>
                        <span className="truncate">{c.content}</span>
                      </div>
                    )}

                    {c.type === 'ProgressBar' && (
                      <div className="w-full h-full bg-slate-800 rounded overflow-hidden relative select-none border border-slate-700 flex items-center justify-center">
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-[#2e7d32]" 
                          style={{ width: `${Math.min(100, Math.max(0, parseInt(c.content) || 0))}%` }}
                        ></div>
                        <span className="z-10 font-mono text-[9px] text-white select-none">
                          {c.content}%
                        </span>
                      </div>
                    )}

                    {c.type === 'ComboBox' && (
                      <div className="w-full h-full rounded border border-slate-700 bg-slate-800/80 px-2 flex items-center justify-between text-xs select-none">
                        <span style={{ color: c.foreground, fontSize: `${c.fontSize}px` }} className="truncate">
                          {c.content}
                        </span>
                        <span className="text-[9px] text-slate-500">▼</span>
                      </div>
                    )}

                    {c.type === 'Image' && (
                      <div className="w-full h-full bg-indigo-950/20 border border-indigo-500/20 rounded flex items-center justify-center overflow-hidden relative">
                        <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-cyan-500 to-indigo-500 animate-pulse"></div>
                        <span className="text-[10px] text-indigo-400 font-bold z-10 font-sans truncate">{c.content}</span>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM RIGHT resizing handle */}
                  {isSelected && (
                    <div
                      onMouseDown={(e) => handleMouseDown(e, c, 'resize')}
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-500 border border-slate-900 rounded-sm cursor-se-resize z-50 flex items-center justify-center shadow"
                      title="拖动调整大小"
                    >
                      <span className="text-[8px] text-slate-950 font-bold select-none leading-none">↘</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Properties Panel & Inspector */}
        <div className={`w-64 flex flex-col shrink-0 select-none border-l ${
          isDarkMode ? 'bg-[#1a1a20] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`p-2.5 border-b flex items-center justify-between ${
            isDarkMode ? 'border-[#2d2d34] bg-[#22222a]/30' : 'border-slate-200 bg-slate-100/60'
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-655'
            }`}>
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>属性与模块 (Inspector)</span>
            </span>
            <div className={`flex p-0.5 rounded border ${
              isDarkMode ? 'bg-[#2a2a34] border-[#3e3e4a]' : 'bg-slate-200/60 border-slate-300'
            }`}>
              <button
                onClick={() => setActiveInspectorTab('properties')}
                className={`p-1.5 rounded cursor-pointer transition-all ${
                  activeInspectorTab === 'properties' 
                    ? isDarkMode ? 'bg-[#3b3b45] text-amber-400 font-bold' : 'bg-white text-amber-600 font-bold shadow-sm'
                    : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-905'
                }`}
                title="控件属性 (Properties)"
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveInspectorTab('events')}
                className={`p-1.5 rounded cursor-pointer transition-all ${
                  activeInspectorTab === 'events' 
                    ? isDarkMode ? 'bg-[#3b3b45] text-amber-400 font-bold' : 'bg-white text-amber-600 font-bold shadow-sm'
                    : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-905'
                }`}
                title="事件绑定参考 (Events)"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveInspectorTab('modules')}
                className={`p-1.5 rounded cursor-pointer transition-all ${
                  activeInspectorTab === 'modules' 
                    ? isDarkMode ? 'bg-[#3b3b45] text-amber-400 font-bold' : 'bg-white text-amber-600 font-bold shadow-sm'
                    : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-905'
                }`}
                title="组件运行时与模块市场 (Modules)"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {activeInspectorTab === 'modules' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ModuleInspector
                isDarkMode={isDarkMode}
                onAddLog={(msg) => {
                  window.dispatchEvent(new CustomEvent('add-app-log', { detail: { message: msg } }));
                }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {selectedControl ? (
                <div className="space-y-3.5">
                  {/* Control Type Status Badge */}
                  <div className={`flex items-center justify-between p-2 rounded border ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold uppercase">控件类型:</span>
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10">
                      {selectedControl.type}
                    </span>
                  </div>

                  {activeInspectorTab === 'properties' ? (
                    <>
                    {/* Control C++ Variable/XAML Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-550 font-semibold block uppercase">
                        中文映射名称 (Variable ID)
                      </label>
                      <input
                        type="text"
                        value={selectedControl.name}
                        onChange={(e) => updateSelectedControl({ name: e.target.value })}
                        className={`w-full border rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 ${
                          isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                        }`}
                      />
                      <p className="text-[9px] text-slate-500 italic mt-0.5">中文变量名，编译后映射为 C++ 类成员</p>
                    </div>

                    {/* Content / Text / Label */}
                    {selectedControl.type !== 'Grid' && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-550 font-semibold block uppercase">
                          {selectedControl.type === 'ProgressBar' ? '当前进度值 (0-100)' : '显示内容/文本 (Content)'}
                        </label>
                        <input
                          type="text"
                          value={selectedControl.content}
                          onChange={(e) => updateSelectedControl({ content: e.target.value })}
                          className={`w-full border rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 ${
                            isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                          }`}
                        />
                      </div>
                    )}

                    {/* Bounds (Width, Height, X, Y) */}
                    <div className={`grid grid-cols-2 gap-2 p-2 rounded border ${
                      isDarkMode ? 'bg-[#22222a]/30 border-[#2d2d34]/40' : 'bg-slate-100/50 border-slate-200'
                    }`}>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 block uppercase font-semibold">宽度 (Width)</span>
                        <input
                          type="number"
                          value={selectedControl.width}
                          onChange={(e) => updateSelectedControl({ width: Math.max(20, parseInt(e.target.value) || 20) })}
                          className={`w-full border rounded px-2 py-0.5 text-xs focus:outline-none ${
                            isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 block uppercase font-semibold">高度 (Height)</span>
                        <input
                          type="number"
                          value={selectedControl.height}
                          onChange={(e) => updateSelectedControl({ height: Math.max(15, parseInt(e.target.value) || 15) })}
                          className={`w-full border rounded px-2 py-0.5 text-xs focus:outline-none ${
                            isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 block uppercase font-semibold">左距 (Margin L)</span>
                        <input
                          type="number"
                          value={selectedControl.x}
                          onChange={(e) => updateSelectedControl({ x: Math.max(0, parseInt(e.target.value) || 0) })}
                          className={`w-full border rounded px-2 py-0.5 text-xs focus:outline-none ${
                            isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 block uppercase font-semibold">顶距 (Margin T)</span>
                        <input
                          type="number"
                          value={selectedControl.y}
                          onChange={(e) => updateSelectedControl({ y: Math.max(0, parseInt(e.target.value) || 0) })}
                          className={`w-full border rounded px-2 py-0.5 text-xs focus:outline-none ${
                            isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Font Size & Colors */}
                    <div className={`space-y-2 p-2 rounded border ${
                      isDarkMode ? 'bg-[#22222a]/30 border-[#2d2d34]/40' : 'bg-slate-100/50 border-slate-200'
                    }`}>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-550 font-semibold block uppercase">
                          字体大小 (FontSize)
                        </label>
                        <input
                          type="range"
                          min="9"
                          max="32"
                          value={selectedControl.fontSize}
                          onChange={(e) => updateSelectedControl({ fontSize: parseInt(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#24242b] rounded-lg appearance-none"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>9px</span>
                          <span>当前: {selectedControl.fontSize}px</span>
                          <span>32px</span>
                        </div>
                      </div>

                      {/* BG color selector */}
                      {selectedControl.type === 'Button' && (
                        <div className="space-y-1.5 pt-1.5">
                          <label className="text-[10px] text-slate-500 font-semibold block uppercase flex items-center gap-1">
                            <Palette className="w-3 h-3 text-cyan-400" />
                            <span>背景画刷颜色</span>
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {['#007ACC', '#2e7d32', '#d32f2f', '#ed6c02', '#3E3E40', '#4a148c', '#111'].map(color => (
                              <button
                                key={color}
                                onClick={() => updateSelectedControl({ background: color })}
                                className="w-4.5 h-4.5 rounded-full border border-slate-600/50 cursor-pointer hover:scale-110 transition-transform relative shrink-0"
                                style={{ backgroundColor: color }}
                                title={color}
                              >
                                {selectedControl.background === color && (
                                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* State Control Switches */}
                    <div className="space-y-2.5">
                      <label className="text-[10px] text-slate-550 font-semibold block uppercase">
                        状态修饰符
                      </label>
                      <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span>启用控件 (IsEnabled)</span>
                        <input
                          type="checkbox"
                          checked={selectedControl.isEnabled}
                          onChange={(e) => updateSelectedControl({ isEnabled: e.target.checked })}
                          className="accent-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span>是否可见 (Visibility)</span>
                        <select
                          value={selectedControl.visibility}
                          onChange={(e) => updateSelectedControl({ visibility: e.target.value as any })}
                          className={`border rounded text-xs px-2 py-0.5 focus:outline-none ${
                            isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-850 shadow-sm'
                          }`}
                        >
                          <option value="Visible">正常显示 (Visible)</option>
                          <option value="Collapsed">布局隐藏 (Collapsed)</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3.5">
                    <div className={`text-[11px] font-sans border-b pb-1.5 mb-1 flex items-center gap-1.5 ${
                      isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-705 border-slate-200'
                    }`}>
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                      <span className="font-semibold text-slate-655">事件绑定 (参考 XML)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                      在输入框中定义该事件的回调函数名，系统将自动生成 C++ 对应中文类下的事件路由处理器定义。
                    </p>

                    {getEventsForType(selectedControl.type).map(ev => {
                      const currentHandler = (selectedControl.events && selectedControl.events[ev.name]) || '';
                      return (
                        <div key={ev.name} className={`space-y-1.5 p-2 rounded border ${
                          isDarkMode ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-100 border-slate-200/80'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{ev.label}</span>
                            <span className="text-[8px] px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-mono font-bold">Event</span>
                          </div>
                          <span className="text-[9.5px] text-slate-500 block leading-tight">{ev.desc}</span>
                          <input
                            type="text"
                            placeholder="如: 开始游戏按钮_Click"
                            value={currentHandler}
                            onChange={(e) => {
                              const updatedEvents = {
                                ...(selectedControl.events || {}),
                                [ev.name]: e.target.value
                              };
                              updateSelectedControl({ events: updatedEvents });
                            }}
                            className={`w-full border rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-amber-500 ${
                              isDarkMode ? 'bg-[#1b1b20] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Delete button */}
                <button
                  onClick={handleDeleteControl}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-950/30 hover:bg-red-900/35 text-red-400 hover:text-red-300 rounded border border-red-900/30 text-xs transition-colors cursor-pointer mt-4"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除此控件</span>
                </button>
              </div>
            ) : (
              <div className={`h-44 flex flex-col items-center justify-center text-center text-xs p-4 border border-dashed rounded ${
                isDarkMode ? 'text-slate-600 border-slate-800' : 'text-slate-400 border-slate-300 bg-slate-50'
              }`}>
                <MousePointer className={`w-6 h-6 mb-2 ${isDarkMode ? 'text-slate-750' : 'text-slate-400'}`} />
                <span>请在左侧添加控件，或在画布中点击选中控件，即可在此编辑其中文映射和尺寸。</span>
              </div>
            )}
          </div>
          )}
        </div>

      </div>

      {/* BOTTOM GENERATED CODE DRAWER (Visual Studio real-time Chinese Code mapping dock!) */}
      <div className={`h-56 flex flex-col shrink-0 select-none border-t ${
        isDarkMode ? 'bg-[#1a1a20] border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
      }`}>
        
        {/* Header Tab controller for the generated code */}
        <div className={`border-b flex items-center justify-between px-4 py-1.5 shrink-0 ${
          isDarkMode ? 'bg-[#22222a] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-550 uppercase tracking-widest">
              实时映射代码生成区 (全部中文化)
            </span>
            <div className={`flex p-0.5 rounded border ${
              isDarkMode ? 'bg-[#2d2d34] border-[#3e3e4a]' : 'bg-slate-200/60 border-slate-300'
            }`}>
              <button
                onClick={() => setViewCodeType('xaml')}
                className={`flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  viewCodeType === 'xaml' 
                    ? isDarkMode ? 'bg-[#3b3b45] text-white' : 'bg-white text-slate-900 shadow-sm' 
                    : isDarkMode ? 'text-slate-400 hover:text-slate-250' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3 h-3 text-cyan-500" />
                <span>MainWindow.xml (中文界面布局)</span>
              </button>
              <button
                onClick={() => setViewCodeType('cpp')}
                className={`flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  viewCodeType === 'cpp' 
                    ? isDarkMode ? 'bg-[#3b3b45] text-white' : 'bg-white text-slate-900 shadow-sm' 
                    : isDarkMode ? 'text-slate-400 hover:text-slate-250' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3 h-3 text-emerald-500" />
                <span>MainWindow.h (中文 C++ 类定义)</span>
              </button>
            </div>
          </div>

          {/* Copy Button */}
          <button
            onClick={() => handleCopyCode(viewCodeType === 'xaml' ? xamlCode : cppCode, viewCodeType)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded cursor-pointer transition-all border ${
              isDarkMode 
                ? 'bg-[#32323f] border-slate-700/50 text-slate-300 hover:bg-[#3d3d4c] hover:text-white' 
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm'
            }`}
          >
            {copiedText === viewCodeType ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>已拷贝中文代码！</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>拷贝代码</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content text-area */}
        <div className="flex-1 overflow-auto p-3 bg-[#0d0d10] font-mono text-[11.5px] leading-relaxed text-slate-300">
          <pre className="whitespace-pre">
            {viewCodeType === 'xaml' ? (
              <span className="text-cyan-400/90">{xamlCode}</span>
            ) : (
              <span className="text-emerald-400/95">{cppCode}</span>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
