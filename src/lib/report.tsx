import { createRoot } from 'react-dom/client';
import { toJpeg } from 'html-to-image';
import ReportDocument from '@/components/ReportDocument';
import type { SimulationResult, PolicyConfig, ScenarioConfig } from '@/lib/types';

interface ReportArgs {
  result: SimulationResult;
  config: ScenarioConfig;
  policy: PolicyConfig;
  scenarioLabel: string;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Build and download a multi-page PDF of the configured-parameters table plus
 * every chart. Charts are rendered into a detached, off-screen container so all
 * tabs are captured (the live dashboard only mounts one tab at a time), then
 * each block is rasterised and paginated onto A4 pages.
 */
export async function downloadReport({ result, config, policy, scenarioLabel }: ReportArgs): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const host = document.createElement('div');
  host.className = 'report-capture';
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:820px;background:#ffffff;z-index:-1;pointer-events:none;';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(
      <ReportDocument result={result} config={config} policy={policy} scenarioLabel={scenarioLabel} />,
    );

    // Let React commit, layout settle, and Recharts finish its entry animation.
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await wait(1900);

    const blocks = Array.from(host.querySelectorAll<HTMLElement>('[data-report-block]'));

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    let cursorY = margin;

    for (const block of blocks) {
      // JPEG keeps the file small (charts are mostly flat fills); quality 0.92
      // keeps axis text / lines crisp at 2× scale.
      const dataUrl = await toJpeg(block, { cacheBust: true, pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff' });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const imgH = (contentW * img.height) / img.width;

      // Page break when this block won't fit in the remaining space.
      if (cursorY + imgH > pageH - margin && cursorY > margin) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.addImage(dataUrl, 'JPEG', margin, cursorY, contentW, imgH);
      cursorY += imgH + 4;
    }

    const safe = scenarioLabel.replace(/[^\w-]+/g, '_');
    pdf.save(`PTCM_report_${safe}_2026-55.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}
