import { useEffect, useState } from 'react';
import ModuleInfoDialog from './ModuleInfoDialog';
import type { InstalledModule } from '../services/modules/types';

export default function ModuleInfoWindow() {
  const [module, setModule] = useState<InstalledModule | null>(null);
  useEffect(() => window.lingBuilder?.modules?.onInfo(value => {
    if (value && typeof value === 'object' && 'manifest' in value) setModule(value as InstalledModule);
  }), []);
  if (!module) return <div className="flex h-screen items-center justify-center bg-[#1f1f1f] text-sm text-slate-400">正在载入模块信息...</div>;
  return <ModuleInfoDialog module={module} isDarkMode={true} standalone onClose={() => window.close()} />;
}
