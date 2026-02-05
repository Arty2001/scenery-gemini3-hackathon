'use client';

import { useState, useRef, useCallback } from 'react';
import type { Track } from '@/lib/composition/types';
import { useCompositionStore } from '@/lib/composition';
import { TimelineClip } from './timeline-clip';
import { cn } from '@/lib/utils';
import {
  Lock, Unlock, MoreHorizontal, Pencil, Eye, EyeOff, Trash2, GripVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TimelineTrackProps {
  track: Track;
  pixelsPerFrame: number;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
  onReorderStart?: (trackId: string, e: React.MouseEvent) => void;
}

export const TRACK_HEIGHT = 48; // pixels

const trackColors: Record<string, string> = {
  component: 'bg-blue-500/10',
  text: 'bg-green-500/10',
  video: 'bg-purple-500/10',
  audio: 'bg-orange-500/10',
};

export function TimelineTrack({
  track,
  pixelsPerFrame,
  selectedItemId,
  onSelectItem,
  onReorderStart,
}: TimelineTrackProps) {
  const updateTrack = useCompositionStore((s) => s.updateTrack);
  const removeTrack = useCompositionStore((s) => s.removeTrack);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== track.name) {
      updateTrack(track.id, { name: trimmed });
    } else {
      setRenameValue(track.name);
    }
    setIsRenaming(false);
  }, [renameValue, track.id, track.name, updateTrack]);

  const startRename = useCallback(() => {
    setRenameValue(track.name);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [track.name]);

  const isHidden = track.visible === false;

  return (
    <div
      className={cn(
        'relative border-b',
        trackColors[track.type] || 'bg-muted/30',
        track.locked && 'opacity-50',
        isHidden && 'opacity-30',
      )}
      style={{ height: TRACK_HEIGHT }}
      onClick={() => onSelectItem(null)}
    >
      {/* Track label sidebar */}
      <div className="absolute left-0 top-0 bottom-0 w-24 flex items-center gap-0.5 px-1 border-r bg-background/80 z-20">
        {/* Drag handle */}
        <button
          type="button"
          className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
          onMouseDown={(e) => {
            e.stopPropagation();
            onReorderStart?.(track.id, e);
          }}
          title="Drag to reorder"
        >
          <GripVertical size={12} />
        </button>

        {/* Track name / rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            className="text-xs font-medium bg-transparent border-b border-ring outline-none w-full min-w-0"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setRenameValue(track.name);
                setIsRenaming(false);
              }
            }}
          />
        ) : (
          <span
            className="text-xs font-medium truncate flex-1 min-w-0"
            title={track.name}
            onDoubleClick={startRename}
          >
            {track.name}
          </span>
        )}

        {/* Dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-36">
            <DropdownMenuItem onClick={startRename}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateTrack(track.id, { locked: !track.locked })}
            >
              {track.locked ? (
                <><Unlock className="mr-2 h-3.5 w-3.5" />Unlock</>
              ) : (
                <><Lock className="mr-2 h-3.5 w-3.5" />Lock</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateTrack(track.id, { visible: !isHidden })}
            >
              {isHidden ? (
                <><Eye className="mr-2 h-3.5 w-3.5" />Show</>
              ) : (
                <><EyeOff className="mr-2 h-3.5 w-3.5" />Hide</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => removeTrack(track.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Track content area with clips */}
      <div
        className={cn(
          'absolute left-24 right-0 top-0 bottom-0',
          (track.locked || isHidden) && 'pointer-events-none'
        )}
      >
        {track.items.map((item) => (
          <TimelineClip
            key={item.id}
            item={item}
            track={track}
            pixelsPerFrame={pixelsPerFrame}
            isSelected={selectedItemId === item.id}
            onSelect={onSelectItem}
          />
        ))}
      </div>
    </div>
  );
}
