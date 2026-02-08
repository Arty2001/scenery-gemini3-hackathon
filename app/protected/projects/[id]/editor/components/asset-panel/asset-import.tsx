'use client';

/**
 * Asset import component.
 * Provides file picker for uploading video, image, and audio files
 * to Supabase Storage and adding them as timeline items.
 */

import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSignedUploadUrl, getAssetPublicUrl } from '@/lib/actions/assets';
import { validateAssetFile, getAssetType } from '@/lib/assets/validation';
import { useCompositionStore } from '@/lib/composition';
import { createClient } from '@/lib/supabase/client';

// =============================================
// Types
// =============================================

interface AssetImportProps {
  projectId: string;
}

// =============================================
// Component
// =============================================

export function AssetImport({ projectId }: AssetImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const addTrack = useCompositionStore((s) => s.addTrack);
  const addItem = useCompositionStore((s) => s.addItem);
  const tracks = useCompositionStore((s) => s.tracks);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        // Validate
        const validation = validateAssetFile(file);
        if (!validation.valid) {
          setError(validation.error ?? 'Invalid file');
          continue;
        }

        setProgress(`Uploading ${file.name}...`);

        // Get signed upload URL
        const uploadData = await createSignedUploadUrl(projectId, file.name);
        if (!uploadData) {
          setError(`Failed to get upload URL for ${file.name}`);
          continue;
        }

        // Upload file
        const { error: uploadError } = await supabase.storage
          .from('project-assets')
          .uploadToSignedUrl(uploadData.path, uploadData.token, file);

        if (uploadError) {
          setError(`Upload failed for ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const publicUrl = await getAssetPublicUrl(uploadData.path);

        // Determine asset type
        const assetType = getAssetType(file.type);
        if (!assetType) continue;

        // Always create a new track for each uploaded media
        const trackType = assetType === 'image' ? 'image' as const : assetType;

        // Use filename (without extension) as track name
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

        addTrack({
          name: fileNameWithoutExt,
          type: trackType,
          locked: false,
          visible: true,
          items: [],
        });

        // Get the newly created track (last one added)
        const currentTracks = useCompositionStore.getState().tracks;
        const targetTrack = currentTracks[currentTracks.length - 1];

        // Add item to track based on type
        if (assetType === 'video') {
          addItem(targetTrack.id, {
            type: 'video',
            src: publicUrl,
            volume: 1,
            startFrom: 0,
            from: 0,
            durationInFrames: 150,
          } as Omit<import('@/lib/composition/types').MediaItem, 'id'>);
        } else if (assetType === 'audio') {
          addItem(targetTrack.id, {
            type: 'audio',
            src: publicUrl,
            volume: 1,
            startFrom: 0,
            from: 0,
            durationInFrames: 150,
          } as Omit<import('@/lib/composition/types').MediaItem, 'id'>);
        } else if (assetType === 'image') {
          addItem(targetTrack.id, {
            type: 'image',
            src: publicUrl,
            from: 0,
            durationInFrames: 150,
          } as Omit<import('@/lib/composition/types').ImageItem, 'id'>);
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {progress ?? 'Import Media'}
      </Button>
      {error && (
        <span className="text-destructive text-xs max-w-[200px] truncate">
          {error}
        </span>
      )}
    </div>
  );
}
