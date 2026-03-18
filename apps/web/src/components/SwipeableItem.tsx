'use client';

import { useRef, useState } from 'react';

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}

export function SwipeableItem({ children, onDelete, deleteLabel = '삭제' }: SwipeableItemProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const THRESHOLD = 60; // 삭제 버튼 너비

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    // 왼쪽으로만 스와이프 허용
    if (dx < 0) setOffset(Math.max(dx, -THRESHOLD));
    else if (offset < 0) setOffset(Math.min(dx + offset, 0));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (offset < -THRESHOLD / 2) {
      setOffset(-THRESHOLD); // 삭제 버튼 고정
    } else {
      setOffset(0); // 닫기
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* 삭제 버튼 (뒤) */}
      <div className="absolute right-0 top-0 bottom-0 w-[60px] flex items-center justify-center bg-red-500">
        <button
          onClick={() => { setOffset(0); onDelete(); }}
          className="text-white text-xs font-medium w-full h-full flex items-center justify-center active:bg-red-600"
        >
          {deleteLabel}
        </button>
      </div>

      {/* 컨텐츠 (앞) */}
      <div
        style={{ transform: `translateX(${offset}px)`, transition: isDragging.current ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  );
}
