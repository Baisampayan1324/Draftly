import { useCallback, useState } from 'react';
import { X, FileText, Image, File, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  id: string;
}

interface FileUploadZoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'text/plain',
];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileUploadZone({ files, onFilesChange }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList) => {
      const valid = Array.from(newFiles).filter(
        (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE
      );
      const remaining = MAX_FILES - files.length;
      const toAdd = valid.slice(0, remaining).map((file) => ({
        file,
        id: crypto.randomUUID(),
      }));
      onFilesChange([...files, ...toAdd]);
    },
    [files, onFilesChange]
  );

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all group',
          dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/40 hover:bg-secondary/50'
        )}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.pdf,.docx,.png,.jpg,.jpeg,.txt';
          input.onchange = () => { if (input.files) addFiles(input.files); };
          input.click();
        }}
      >
        <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Attach files for context
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          PDF, DOCX, PNG, JPG, TXT · Max 10MB · Up to 5 files
        </p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(({ file, id }) => {
            const Icon = getFileIcon(file.type);
            return (
              <div
                key={id}
                className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2 text-sm animate-scale-in"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                <button onClick={(e) => { e.stopPropagation(); removeFile(id); }} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
