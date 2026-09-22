import { useEffect, useState } from 'react';
import { fetchLingBuilderBuildInfo, formatBuildStamp } from '../services/product/buildInfo';

/**
 * 标题栏构建时间戳：v0.7.6 · 构建 0920 18:17。
 * 同版本号重打包无法靠版本号分辨新旧（2026-09-20 排查踩坑），构建时间是用户可见的
 * 新旧判据；dist/build-meta.json 缺失（dev 源码模式）时整段不渲染。
 */
export default function BuildStampLabel({ className = 'font-normal text-cyan-400/80' }: { className?: string }) {
  const [stamp, setStamp] = useState('');
  useEffect(() => {
    let cancelled = false;
    void fetchLingBuilderBuildInfo().then(info => {
      if (!cancelled) setStamp(info ? formatBuildStamp(info.buildTime) : '');
    });
    return () => { cancelled = true; };
  }, []);
  if (!stamp) return null;
  return <span className={className}> · 构建 {stamp}</span>;
}
