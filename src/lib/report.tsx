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
    const CHARTS_PER_PAGE = 2;
    let cursorY = margin;
    let chartsOnPage = 0;

    const atPageTop = () => cursorY <= margin + 0.01;
    const newPage = () => { pdf.addPage(); cursorY = margin; chartsOnPage = 0; };

    for (const block of blocks) {
      const kind = (block.dataset.blockKind ?? 'intro') as 'intro' | 'section' | 'chart';

      // JPEG keeps the file small (charts are mostly flat fills); quality 0.92
      // keeps axis text / lines crisp at 2× scale.
      const dataUrl = await toJpeg(block, { cacheBust: true, pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff' });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const imgH = (contentW * img.height) / img.width;

      if (kind === 'section') {
        // Each section opens at the top of a fresh page (banner never orphans).
        if (!atPageTop()) newPage();
        chartsOnPage = 0;
      } else if (kind === 'chart') {
        // Cap at 2 charts per page; also break if it simply won't fit.
        if (chartsOnPage >= CHARTS_PER_PAGE || (cursorY + imgH > pageH - margin && !atPageTop())) {
          newPage();
        }
        chartsOnPage += 1;
      } else if (cursorY + imgH > pageH - margin && !atPageTop()) {
        // intro blocks: flow, breaking only when they won't fit.
        newPage();
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
