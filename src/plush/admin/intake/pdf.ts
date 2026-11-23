// Reads the text (with positions) out of a PDF in the browser, using pdf.js.
// The file never leaves the device. pdf.js is loaded only when someone picks a
// PDF, so it adds nothing to the admin page's normal load.

import { groupPdfLines, type PdfLine, type PdfTextItem } from "./parse";

export const MAX_PDF_PAGES = 30;

export async function readPdfLines(file: File): Promise<PdfLine[]> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // Only the text is needed: no fonts, and no WebAssembly image decoders.
    disableFontFace: true,
    useWasm: false,
  });
  const doc = await task.promise;

  try {
    const items: PdfTextItem[] = [];
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let page = 1; page <= pages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height || Math.abs(item.transform[3]),
          page,
        });
      }
    }
    return groupPdfLines(items);
  } finally {
    void task.destroy();
  }
}
