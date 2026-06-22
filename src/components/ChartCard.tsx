import { useRef, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Table2, ImageDown } from 'lucide-react';
import { exportPNG, exportCSV, exportXLSX } from '@/lib/exporters';

interface Props {
  title: string;
  description?: string;
  subtitle?: string;
  children: ReactNode;
  csvData?: Record<string, unknown>[];
  csvFilename?: string;
}

export default function ChartCard({ title, description, subtitle, children, csvData, csvFilename }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showTable, setShowTable] = useState(false);
  const fname = csvFilename || title;

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-0.5 min-w-0">
          <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {/* PNG download — top-right of the card header, in line with the title,
            independent of the data buttons below. */}
        <Button
          variant="ghost" size="sm"
          className="h-7 shrink-0 gap-1 px-1.5 text-[10px] font-medium tracking-wide"
          onClick={() => chartRef.current && exportPNG(chartRef.current, fname)}
          title="Download chart as PNG"
        >
          <ImageDown className="h-3.5 w-3.5" />
          PNG
        </Button>
      </CardHeader>
      <CardContent className="pb-3">
        <div ref={chartRef} className="h-[320px]">
          {children}
        </div>

        {/* Data table — shown above the action buttons */}
        {showTable && csvData && (
          <div className="mt-3 border-t pt-2">
            <div className="max-h-48 overflow-auto text-[10px]">
              <table className="w-full">
                <thead>
                  <tr>
                    {Object.keys(csvData[0] || {}).map(k => (
                      <th key={k} className="sticky top-0 z-10 bg-card px-1 py-0.5 text-left font-medium text-muted-foreground">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {csvData.slice(0, 31).map((row, i) => (
                    <tr key={i} className="odd:bg-muted/40">
                      {Object.entries(row).map(([k, v], j) => (
                        <td key={j} className="px-1 py-0.5">{typeof v === 'number' && k !== 'year' ? v.toLocaleString() : String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data buttons — placed below the chart (and data table) */}
        {csvData && (
          <div className="mt-3 border-t pt-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Data Table
            </div>
            <div className="flex flex-wrap items-center gap-0.5">
              <Button
                variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[10px] font-medium tracking-wide"
                onClick={() => setShowTable(t => !t)}
                title="View data table"
              >
                <Table2 className="h-3.5 w-3.5" />
                View
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[10px] font-medium tracking-wide"
                onClick={() => exportCSV(csvData, fname)}
                title="Download as CSV"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[10px] font-medium tracking-wide"
                onClick={() => exportXLSX(csvData, fname)}
                title="Download as Excel"
              >
                <Download className="h-3.5 w-3.5" />
                Excel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
