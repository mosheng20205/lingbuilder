import { useEffect, useState } from 'react';
import ModuleDetailPage from './ModuleDetailPage';
import type { InstalledModule } from '../services/modules/types';

/** 独立模块信息窗口（解决方案树「查看完整接口说明」/ 右键「查看模块信息」的第二入口）。
 *  与主区「模块详情」页签共用同一个 ModuleDetailPage：standalone 只读模式，Esc 关闭。 */
export default function ModuleInfoWindow() {
  const [module, setModule] = useState<InstalledModule | null>(null);
  useEffect(() => window.lingBuilder?.modules?.onInfo(value => {
    if (value && typeof value === 'object' && 'manifest' in value) setModule(value as InstalledModule);
  }), []);
  if (!module) return <div className="flex h-screen items-center justify-center bg-[#1f1f1f] text-sm text-slate-400">正在载入模块信息...</div>;
  return (
    <div className="h-screen">
      <ModuleDetailPage
        moduleId={module.manifest.id}
        standaloneModule={module}
        isDarkMode={true}
        onClose={() => window.close()}
      />
    </div>
  );
}
