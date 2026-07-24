import React from 'react';

interface UpDownDesignerPreviewProps {
  isEnabled: boolean;
}

export default function UpDownDesignerPreview({ isEnabled }: UpDownDesignerPreviewProps) {
  return (
    <div
      aria-label="数值调节器预览"
      className="flex h-full w-full flex-col overflow-hidden border border-[#8a8a8a] bg-[#f0f0f0]"
      style={{ opacity: isEnabled ? 1 : 0.55 }}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center border-b border-[#a0a0a0] bg-gradient-to-b from-white to-[#e5e5e5]">
        <svg aria-hidden="true" viewBox="0 0 10 6" className="h-[6px] w-[10px] text-[#202020]">
          <path d="M1 5 5 1l4 4Z" fill="currentColor" />
        </svg>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-b from-white to-[#e5e5e5]">
        <svg aria-hidden="true" viewBox="0 0 10 6" className="h-[6px] w-[10px] text-[#202020]">
          <path d="m1 1 4 4 4-4Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
