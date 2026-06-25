import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useScenario } from '@/contexts/ScenarioContext';
import { downloadParamsCsv, downloadParamsXlsx, importParamsFile } from '@/lib/paramFile';

/**
 * Import / export of the user-configurable parameters as a CSV or Excel file.
 * Download writes the current values; upload merges a file's values back into
 * the dashboard (charts update immediately) with an acknowledgement toast.
 */
export default function ParameterFileIO() {
  const { config, draftConfig, importConfig } = useScenario();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async (file: File) => {
    setBusy(true);
    try {
      // Merge onto the in-progress draft so any unsaved edits / pins survive.
      const { config: next, applied, unknownKeys } = await importParamsFile(file, draftConfig);
      importConfig(next);
      toast.success('Parameters loaded', {
        description:
          `Loaded ${applied} parameter${applied === 1 ? '' : 's'} from ${file.name}. ` +
          `Click "Apply Changes" to update the charts.` +
          (unknownKeys.length ? ` ${unknownKeys.length} unrecognised row(s) were skipped.` : ''),
      });
    } catch (err) {
      toast.error('Could not import file', {
        description: err instanceof Error ? err.message : 'Unexpected error reading the file.',
      });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 flex-1" disabled={busy}>
            <Download className="h-3.5 w-3.5" /> Download
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => downloadParamsCsv(config)}>
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadParamsXlsx(config)}>
            Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 flex-1"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
      >
        {busy
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</>
          : <><Upload className="h-3.5 w-3.5" /> Upload</>}
      </Button>

      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />
    </div>
  );
}
