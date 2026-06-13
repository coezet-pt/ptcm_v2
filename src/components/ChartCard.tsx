import { useRef, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Table2 } from 'lucide-react';
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
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0 gap-2">
        <div className="space-y-0.5 min-w-0">
          <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {csvData && (
            <>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setShowTable(t => !t)}
                title="Toggle data table"
              >
                <Table2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] font-mono tracking-wide"
                onClick={() => exportCSV(csvData, fname)}
                title="Download CSV"
              >
                CSV
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] font-mono tracking-wide"
                onClick={() => exportXLSX(csvData, fname)}
                title="Download Excel"
              >
                XLSX
              </Button>
            </>
          )}
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => chartRef.current && exportPNG(chartRef.current, fname)}
            title="Download PNG"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div ref={chartRef} className="h-[320px]">
          {children}
        </div>
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
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-1 py-0.5">{typeof v === 'number' ? v.toLocaleString() : String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
