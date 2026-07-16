import { Injectable } from '@angular/core';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import jsPDF from 'jspdf';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

@Injectable({
  providedIn: 'root'
})

export class PdfCreatorService {

  constructor(private fileOpener: FileOpener) {
    pdfMake['vfs'] = pdfFonts['vfs'] as unknown as { [file: string]: string };

   }

   /*
   async generateWithJsPDF(html: string): Promise<jsPDF> {
    const doc = new jsPDF({
      format: 'a4',
      unit: 'pt',
      orientation: 'landscape'
    });
    await new Promise<void>((resolve) => {
      doc.html(html, {
        callback: () => resolve(),
        x: 10, y: 10
      });
    });

    return doc;

  }
    */
 // replace the existing generateWithJsPDF with this:

private inlineAllComputedStyles(original: HTMLElement, clone: HTMLElement) {
    const origElements = original.querySelectorAll<HTMLElement>('*');
    const cloneElements = clone.querySelectorAll<HTMLElement>('*');

    // copy styles for root element too
    this.copyComputedStyles(original, clone);

    const len = Math.min(origElements.length, cloneElements.length);
    for (let i = 0; i < len; i++) {
      this.copyComputedStyles(origElements[i], cloneElements[i]);
    }
  }

  private copyComputedStyles(sourceEl: HTMLElement, targetEl: HTMLElement) {
    const computed = window.getComputedStyle(sourceEl);
    // iterate computed style properties and set them inline on the target
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      try {
        const val = computed.getPropertyValue(prop);
        const priority = computed.getPropertyPriority(prop);
        targetEl.style.setProperty(prop, val, priority);
      } catch (e) {
        // some properties may be read-only or throw — ignore them
      }
    }
  }

  /**
   * Generate jsPDF from an element or html string, ensuring the whole content
   * (not only visible viewport) is captured. Returns a fully rendered jsPDF.
   *
   * Usage: pass the element reference (preferred) or HTML string.
   */
// place inside PdfCreatorService in pdf-creator.service.ts
// ...existing class code...
async generateWithJsPDF(source: HTMLElement | string, opts?: { orientation?: 'portrait' | 'landscape', scale?: number, layoutScale?: number }): Promise<jsPDF> {
  // renderScale (pixel density) used by html2canvas:
  let renderScale = opts?.scale ?? 3;

  const doc = new jsPDF({
    format: 'letter',
    unit: 'pt',
    orientation: opts?.orientation ?? 'landscape'
  });

  // compute page width in CSS px before measuring any HTML so string-based sources
  // can be laid out at the final export width instead of their intrinsic narrow width.
  const pageWidthPt = doc.internal.pageSize.getWidth();
  const ptToPx = 96 / 72;
  const pageWidthPx = Math.round(pageWidthPt * ptToPx);
  const layoutScale = typeof opts?.layoutScale === 'number' ? opts.layoutScale : 1;
  const targetCloneWidthPx = Math.round(pageWidthPx * layoutScale);

  // prepare original element (wrap string if needed)
  let originalElement: HTMLElement;
  let removeOriginalWrapper = false;
  if (typeof source === 'string') {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = source;
    wrapper.style.width = `${targetCloneWidthPx}px`;
    wrapper.style.maxWidth = `${targetCloneWidthPx}px`;
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-20000px';
    wrapper.style.top = '0';
    wrapper.style.visibility = 'hidden';
    wrapper.style.pointerEvents = 'none';
    document.body.appendChild(wrapper);
    originalElement = wrapper;
    removeOriginalWrapper = true;
  } else {
    originalElement = source as HTMLElement;
  }

  // ensure layout metrics reflect the final width before copying computed styles.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  // clone & inline styles
  const cloned = originalElement.cloneNode(true) as HTMLElement;
  this.inlineAllComputedStyles(originalElement, cloned);

  // set cloned layout width (this affects how table columns wrap/size)
  cloned.style.width = `${targetCloneWidthPx}px`;
  cloned.style.minWidth = `${targetCloneWidthPx}px`;
  cloned.style.maxWidth = `${targetCloneWidthPx}px`;
  cloned.style.maxHeight = 'none';
  cloned.style.overflow = 'visible';
  cloned.style.boxSizing = 'border-box';

  // Add a class to the clone so PDF-only CSS can be applied
  cloned.classList.add('pdf-export-scale');

  // place the clone in the document for rendering
  cloned.style.position = 'absolute';
  cloned.style.left = '0';
  cloned.style.top = '0';
  cloned.style.zIndex = '99999';
  cloned.style.visibility = 'visible';
  cloned.style.pointerEvents = 'none';

  document.body.appendChild(cloned);

  // wait for fonts to be ready if possible
  if ((document as any).fonts && (document as any).fonts.ready) {
    try { await (document as any).fonts.ready; } catch (e) { /* ignore */ }
  }

  // ensure a layout pass has occured (use RAF rather than arbitrary timeout)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  // Now that the clone is in the DOM and laid out, find header element and measure its CSS height & offset
  const headerEl = cloned.querySelector('thead') ?? cloned.querySelector('.cabecera');
  let headerCssHeight = 0;
  let headerCssOffset = 0;
  if (headerEl && headerEl instanceof HTMLElement) {
    headerCssHeight = headerEl.scrollHeight || headerEl.offsetHeight || 0;
    try {
      const clonedRect = cloned.getBoundingClientRect();
      const headerRect = headerEl.getBoundingClientRect();
      headerCssOffset = headerRect.top - clonedRect.top;
      if (!headerCssOffset) {
        headerCssOffset = headerEl.offsetTop || 0;
      }
    } catch (e) {
      headerCssOffset = headerEl.offsetTop || 0;
    }
  }

  // fetch html2canvas (use existing global or dynamic import)
  // @ts-ignore
  const html2canvasFn = (window as any).html2canvas ?? (await import('html2canvas')).default;

  // helper to try rendering canvas with scale and check max dimension limits
  const MAX_CANVAS_DIM = 32767; // conservative cross-browser safe limit
  let canvas: HTMLCanvasElement | null = null;
  let attemptScale = renderScale;

  while (true) {
    // compute desired width/height for html2canvas based on clone's scrollWidth/scrollHeight
    const targetWidthPx = cloned.scrollWidth;
    const targetHeightPx = cloned.scrollHeight;

    // html2canvas options to ensure full element is captured
    canvas = await html2canvasFn(cloned, {
      useCORS: true,
      allowTaint: false,
      scale: attemptScale,
      logging: false,
      width: targetWidthPx,
      height: targetHeightPx,
      windowWidth: targetWidthPx,
      windowHeight: targetHeightPx
    });
    if (!canvas) {
      throw new Error('html2canvas failed to produce a canvas');
    }
    // check if produced canvas fits within safe limits
    if (canvas.width <= MAX_CANVAS_DIM && canvas.height <= MAX_CANVAS_DIM) {
      // success
      renderScale = attemptScale; // record actual renderScale used
      break;
    }

    // if too large, reduce scale and retry
    if (attemptScale <= 1) {
      // Can't reduce further; accept this canvas (might be clipped by browser)
      break;
    }
    attemptScale = Math.max(1, Math.floor(attemptScale / 2));
    // free memory before next attempt
    canvas.remove();
  }

  // compute header metrics in canvas pixels (if header exists)
  const headerCanvasOffsetPx = Math.round(headerCssOffset * renderScale);
  const headerCanvasHeightPx = Math.round(headerCssHeight * renderScale);

  // cleanup cloned element and original wrapper (if created)
  cloned.remove();
  if (removeOriginalWrapper && originalElement.parentElement) {
    originalElement.remove();
  }

  // Convert canvas to image and insert into PDF, splitting into pages as needed.
  const imgData = canvas.toDataURL('image/png');

  // Compute heights in PDF points:
  const pxToPt = 72 / 96;
  const cssHeightPx = canvas.height / renderScale;
  const imgHeightPtTotal = cssHeightPx * pxToPt;
  const imgWidthPt = pageWidthPt;

  const pageHeightPt = doc.internal.pageSize.getHeight();

  // If content fits on one page, just add it and return
  if (imgHeightPtTotal <= pageHeightPt) {
    doc.addImage(imgData, 'PNG', 0, 0, imgWidthPt, imgHeightPtTotal);
    return doc;
  }

  // Otherwise split into pages:
  const pageHeightCssPx = pageHeightPt * ptToPx; // page height in CSS px
  const totalCssHeightPx = cssHeightPx;
  let yOffsetCss = 0;
  let pageIndex = 0;

  // tmp canvas used for slicing
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d')!;

  tmpCanvas.width = canvas.width; // pixel width
  tmpCanvas.height = Math.min(Math.round(pageHeightCssPx * renderScale), canvas.height);

  while (yOffsetCss < totalCssHeightPx) {
    const yOffsetPx = Math.round(yOffsetCss * renderScale);
    const sliceHeightPx = Math.min(Math.round(pageHeightCssPx * renderScale), canvas.height - yOffsetPx);

    // prepare the slice for this page: draw slice from the full canvas
    tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    tmpCanvas.height = sliceHeightPx;
    tmpCtx.drawImage(canvas, 0, yOffsetPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    // If this is the first page, it already includes the header at the top (yOffsetCss==0)
    if (pageIndex === 0) {
      const sliceData = tmpCanvas.toDataURL('image/png');
      const sliceCssHeightPx = sliceHeightPx / renderScale;
      const sliceHeightPt = sliceCssHeightPx * pxToPt;
      doc.addImage(sliceData, 'PNG', 0, 0, imgWidthPt, sliceHeightPt);
    } else {
      // Compose header + slice: create a canvas tall enough for header + slice
      const compositeCanvas = document.createElement('canvas');
      const compCtx = compositeCanvas.getContext('2d')!;

      // composite must include header + slice
      const compositeHeightPx = headerCanvasHeightPx + sliceHeightPx;
      compositeCanvas.width = canvas.width;
      compositeCanvas.height = compositeHeightPx;

      // draw header portion from the full canvas using correct offset
      if (headerCanvasHeightPx > 0) {
        // draw header from its canvas offset:
        compCtx.drawImage(canvas, 0, headerCanvasOffsetPx, canvas.width, headerCanvasHeightPx, 0, 0, canvas.width, headerCanvasHeightPx);
      }
      // draw the current slice below the header
      compCtx.drawImage(tmpCanvas, 0, 0, canvas.width, sliceHeightPx, 0, headerCanvasHeightPx, canvas.width, sliceHeightPx);

      const compositeData = compositeCanvas.toDataURL('image/png');

      // compute composite height in PDF points:
      const compositeCssHeightPx = (headerCanvasHeightPx + sliceHeightPx) / renderScale;
      const compositeHeightPt = compositeCssHeightPx * pxToPt;

      doc.addPage();
      doc.addImage(compositeData, 'PNG', 0, 0, imgWidthPt, compositeHeightPt);
    }

    yOffsetCss += pageHeightCssPx;
    pageIndex++;
  }

  return doc;
}

  async generateSummaryPdfDoc(data: {
    title: string;
    meta?: Array<{ label: string; value: string }>;
    columns: Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string; noWrap?: boolean; maxLines?: number }>;
    rows: Array<Array<string>>;
    /** @deprecated Prefer summaryTotalsRow for tabular footer */
    total?: { label: string; value: string };
    /** Fila final tipo tabla: primera celda agrupa columnas (ej. colspan 2) con etiqueta centrada */
    summaryTotalsRow?: {
      labelColumnSpan: number;
      leftLabel: string;
      detailLines: string[];
    };
    fileName?: string;
    /** @deprecated Usar enterpriseHeader.logoBase64 */
    logoBase64?: string | null;
    enterpriseHeader?: {
      name: string;
      rif?: string;
      address?: string;
      logoBase64?: string | null;
    };
  }, opts?: { orientation?: 'portrait' | 'landscape', scale?: number, layoutScale?: number, format?: 'letter' | 'legal' }): Promise<jsPDF> {
    const doc = new jsPDF({
      format: opts?.format ?? 'letter',
      unit: 'pt',
      orientation: opts?.orientation ?? 'landscape'
    });

    const headerColor: [number, number, number] = [89, 176, 45];
    const headerBorderColor: [number, number, number] = [159, 205, 138];
    const bodyBorderColor: [number, number, number] = [216, 229, 208];
    const altRowColor: [number, number, number] = [247, 251, 243];
    const totalColor: [number, number, number] = [237, 247, 230];

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 28;
    const topMargin = 24;
    const bottomMargin = 28;
    const usableWidth = pageWidth - marginX * 2;
    const rowPaddingX = 10;
    const condensedTable = data.columns.length >= 10;
    const rowPaddingY = condensedTable ? 6 : 8;
    const lineHeight = condensedTable ? 12 : 14;
    /** Solo grid de productos (cabecera + filas de datos) */
    const tableCellFontPt = 9;
    const tableLineHeight = condensedTable ? 11 : 12;
    const tableHeaderHeight = condensedTable ? 28 : 32;
    /** Fila Totales al pie: mantiene tamaño legible distinto al grid */
    const footerSummaryFontPt = condensedTable ? 10 : 12;
    const footerSummaryLineHeight = condensedTable ? 12 : 13;

    const normalizedWidths = this.normalizeSummaryColumnWidths(data.columns, usableWidth);
    let cursorY = topMargin;
    let pageNumber = 1;

    const resolveEnterpriseLogo = (): string | null =>
      data.enterpriseHeader?.logoBase64 ?? data.logoBase64 ?? null;

    const drawEnterpriseLetterhead = (): number => {
      const header = data.enterpriseHeader;
      const logoBase64 = resolveEnterpriseLogo();
      const name = (header?.name || '').trim();
      const rif = (header?.rif || '').trim();
      const address = (header?.address || '').trim();
      const hasContent = !!(name || rif || address || logoBase64);
      if (!hasContent) {
        return 0;
      }

      const logoSize = 52;
      const logoGap = 12;
      const sectionPaddingY = 8;
      let textX = marginX;
      let logoDrawn = false;

      if (logoBase64) {
        logoDrawn = this.drawEnterpriseLogo(
          doc,
          logoBase64,
          marginX,
          cursorY + sectionPaddingY,
          logoSize,
          logoSize
        );
        if (logoDrawn) {
          textX = marginX + logoSize + logoGap;
        }
      }

      const textWidth = Math.max(80, usableWidth - (textX - marginX));
      let textY = cursorY + sectionPaddingY + 4;
      let textBlockHeight = 0;

      if (name) {
        doc.setTextColor(32, 32, 32);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        const nameLines = doc.splitTextToSize(this.escapePdfText(name), textWidth);
        doc.text(nameLines, textX, textY);
        const lineCount = Array.isArray(nameLines) ? nameLines.length : 1;
        textY += lineCount * 15;
        textBlockHeight += lineCount * 15;
      }

      if (rif) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(this.escapePdfText(`RIF: ${rif}`), textX, textY);
        textY += 13;
        textBlockHeight += 13;
      }

      if (address) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const addressLines = doc.splitTextToSize(this.escapePdfText(address), textWidth);
        doc.text(addressLines, textX, textY);
        const lineCount = Array.isArray(addressLines) ? addressLines.length : 1;
        textBlockHeight += lineCount * 12;
      }

      const logoBlockHeight = logoDrawn ? logoSize + sectionPaddingY * 2 : 0;
      const textBlockTotal = textBlockHeight + sectionPaddingY * 2;
      const letterheadHeight = Math.max(logoBlockHeight, textBlockTotal, 56);

      doc.setDrawColor(216, 229, 208);
      doc.setLineWidth(0.75);
      doc.line(marginX, cursorY + letterheadHeight, marginX + usableWidth, cursorY + letterheadHeight);

      cursorY += letterheadHeight + 12;
      return letterheadHeight + 12;
    };

    const drawPageHeader = (continued = false) => {
      if (!continued) {
        drawEnterpriseLetterhead();
      }

      const headerHeight = 48;
      doc.setFillColor(...headerColor);
      doc.roundedRect(marginX, cursorY, usableWidth, headerHeight, 8, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(continued ? 20 : 22);
      const titleY = cursorY + (continued ? 20 : 22);
      doc.text(this.escapePdfText(data.title), marginX + 16, titleY);
      cursorY += headerHeight + 18;
    };

    const drawMeta = () => {
      const meta = data.meta ?? [];
      if (meta.length === 0) {
        return;
      }

      const metaGap = 14;
      const metaColumns = 2;
      const metaWidth = (usableWidth - metaGap) / metaColumns;
      const labelWidth = 92;
      const chunkedMeta: Array<Array<{ label: string; value: string } | undefined>> = [];

      for (let i = 0; i < meta.length; i += metaColumns) {
        chunkedMeta.push([meta[i], meta[i + 1]]);
      }

      chunkedMeta.forEach(row => {
        const heights = row.map(item => {
          if (!item) {
            return 0;
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          const valueLines = doc.splitTextToSize(this.escapePdfText(item.value), metaWidth - labelWidth - 22);
          return Math.max(28, valueLines.length * lineHeight + rowPaddingY * 2);
        });

        const metaRowHeight = Math.max(...heights, 28);

        if (cursorY + metaRowHeight > pageHeight - bottomMargin) {
          doc.addPage();
          pageNumber += 1;
          cursorY = topMargin;
          drawPageHeader(true);
        }

        row.forEach((item, index) => {
          if (!item) {
            return;
          }

          const x = marginX + index * (metaWidth + metaGap);
          doc.setDrawColor(...bodyBorderColor);
          doc.setFillColor(251, 253, 249);
          doc.roundedRect(x, cursorY, metaWidth, metaRowHeight, 6, 6, 'FD');

          doc.setTextColor(47, 58, 47);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(this.escapePdfText(item.label), x + 10, cursorY + 17);

          doc.setTextColor(32, 32, 32);
          doc.setFont('helvetica', 'normal');
          const valueLines = doc.splitTextToSize(this.escapePdfText(item.value), metaWidth - labelWidth - 22);
          doc.text(valueLines, x + labelWidth, cursorY + 17);
        });

        cursorY += metaRowHeight + 10;
      });
    };

    const drawTableHeader = () => {
      let cellX = marginX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(tableCellFontPt);
      const headerTextY = cursorY + tableHeaderHeight / 2 + tableCellFontPt * 0.35;
      data.columns.forEach((column, index) => {
        const cellWidth = normalizedWidths[index];
        doc.setFillColor(...headerColor);
        doc.setDrawColor(...headerBorderColor);
        doc.rect(cellX, cursorY, cellWidth, tableHeaderHeight, 'FD');
        doc.setTextColor(255, 255, 255);
        const align = column.align ?? 'left';
        const textX = this.getAlignedTextX(cellX, cellWidth, align, rowPaddingX);
        doc.text(this.escapePdfText(column.label), textX, headerTextY, { align: align as 'left' | 'center' | 'right' });
        cellX += cellWidth;
      });
      cursorY += tableHeaderHeight;
    };

    const ensureTableSpace = (requiredHeight: number) => {
      if (cursorY + requiredHeight <= pageHeight - bottomMargin) {
        return;
      }

      doc.addPage();
      pageNumber += 1;
      cursorY = topMargin;
      drawPageHeader(true);
      drawTableHeader();
    };

    drawPageHeader(false);
    drawMeta();
    drawTableHeader();

    data.rows.forEach((row, rowIndex) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(tableCellFontPt);

      const preparedCells = row.map((cell, columnIndex) => {
        const column = data.columns[columnIndex] ?? {};
        const cellWidth = normalizedWidths[columnIndex];
        const availableWidth = Math.max(20, cellWidth - rowPaddingX * 2);

        let lines: string[];
        const raw = String(cell ?? '');
        if (column.noWrap) {
          lines = [this.escapePdfText(raw)];
        } else {
          const escaped = this.escapePdfText(raw);
          const paragraphs = escaped.split(/\n/);
          let built: string[] = [];
          paragraphs.forEach(para => {
            const chunks = doc.splitTextToSize(para, availableWidth);
            built = built.concat(Array.isArray(chunks) ? chunks : [String(chunks)]);
          });
          lines = built;
        }

        if (column.maxLines && lines.length > column.maxLines) {
          lines = lines.slice(0, column.maxLines);
          const lastIndex = lines.length - 1;
          lines[lastIndex] = `${String(lines[lastIndex]).replace(/\s+$/g, '')}...`;
        }

        return lines;
      });

      const rowHeight = Math.max(
        condensedTable ? 26 : 28,
        ...preparedCells.map(lines => lines.length * tableLineHeight + rowPaddingY * 2)
      );

      ensureTableSpace(rowHeight);

      let cellX = marginX;
      preparedCells.forEach((lines, columnIndex) => {
        const column = data.columns[columnIndex] ?? {};
        const cellWidth = normalizedWidths[columnIndex];
        doc.setFillColor(...(rowIndex % 2 === 0 ? [255, 255, 255] as [number, number, number] : altRowColor));
        doc.setDrawColor(...bodyBorderColor);
        doc.rect(cellX, cursorY, cellWidth, rowHeight, 'FD');
        doc.setTextColor(32, 32, 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(tableCellFontPt);
        const align = column.align ?? 'left';
        const textX = this.getAlignedTextX(cellX, cellWidth, align, rowPaddingX);
        doc.text(lines, textX, cursorY + rowPaddingY + tableCellFontPt * 0.85, { align: align as 'left' | 'center' | 'right' });
        cellX += cellWidth;
      });

      cursorY += rowHeight;
    });

    const drawMergedSummaryTotalsRow = () => {
      const footer = data.summaryTotalsRow;
      if (!footer || footer.detailLines.length === 0) {
        return;
      }

      const span = Math.min(
        Math.max(1, Math.floor(Number(footer.labelColumnSpan))),
        Math.max(1, data.columns.length - 1)
      );

      const widthLeftPx = normalizedWidths.slice(0, span).reduce((a, b) => a + b, 0);
      const widthRightPx = usableWidth - widthLeftPx;
      const availableRight = Math.max(20, widthRightPx - rowPaddingX * 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(footerSummaryFontPt);

      let detailBuilt: string[] = [];
      footer.detailLines.forEach(para => {
        const trimmed = para.trimEnd();
        if (!trimmed) {
          detailBuilt.push('');
          return;
        }
        const chunks = doc.splitTextToSize(this.escapePdfText(trimmed), availableRight);
        detailBuilt = detailBuilt.concat(Array.isArray(chunks) ? chunks : [String(chunks)]);
      });

      const rowHeightTotals = Math.max(
        condensedTable ? 38 : 40,
        rowPaddingY * 2 + detailBuilt.length * footerSummaryLineHeight
      );

      ensureTableSpace(rowHeightTotals);

      doc.setDrawColor(184, 217, 167);
      doc.setFillColor(...totalColor);
      doc.rect(marginX, cursorY, widthLeftPx, rowHeightTotals, 'FD');
      doc.rect(marginX + widthLeftPx, cursorY, widthRightPx, rowHeightTotals, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(footerSummaryFontPt);
      doc.setTextColor(29, 53, 21);
      const leftCenterX = marginX + widthLeftPx / 2;
      const footerLineH = footerSummaryLineHeight;
      const baselineLeft = cursorY + (rowHeightTotals - footerLineH) / 2 + footerLineH * 0.75;
      doc.text(this.escapePdfText(footer.leftLabel), leftCenterX, baselineLeft, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      let ty = cursorY + rowPaddingY + footerLineH;
      detailBuilt.forEach(line => {
        const text = line.trim() ? line : ' ';
        doc.text(text, marginX + widthLeftPx + widthRightPx - rowPaddingX, ty, { align: 'right' });
        ty += footerLineH;
      });

      cursorY += rowHeightTotals;
    };

    if (data.summaryTotalsRow?.detailLines?.length) {
      drawMergedSummaryTotalsRow();
    } else if (data.total) {
      const totalText = this.escapePdfText(`${data.total.label}: ${data.total.value}`);
      const totalTextWidth = Math.max(20, usableWidth - rowPaddingX * 2);
      const totalLines = doc.splitTextToSize(totalText, totalTextWidth);
      const totalHeight = Math.max(36, totalLines.length * lineHeight + rowPaddingY * 2);

      ensureTableSpace(totalHeight);

      doc.setDrawColor(184, 217, 167);
      doc.setFillColor(...totalColor);
      doc.rect(marginX, cursorY, usableWidth, totalHeight, 'FD');

      doc.setTextColor(29, 53, 21);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(totalLines, marginX + usableWidth - rowPaddingX, cursorY + rowPaddingY + 12, { align: 'right' });
      cursorY += totalHeight;
    }

    if (pageNumber > 1) {
      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text(`Pagina ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 10, { align: 'right' });
      }
    }

    return doc;
  }

  private normalizeSummaryColumnWidths(columns: Array<{ width?: string }>, usableWidth: number): number[] {
    const widths = columns.map(column => {
      if (!column.width) {
        return 0;
      }

      const value = Number.parseFloat(column.width.replace('%', ''));
      return Number.isFinite(value) ? value : 0;
    });

    const totalPercent = widths.reduce((sum, width) => sum + width, 0);
    if (totalPercent <= 0) {
      return columns.map(() => usableWidth / Math.max(1, columns.length));
    }

    return widths.map(width => (usableWidth * width) / totalPercent);
  }

  private getAlignedTextX(cellX: number, cellWidth: number, align: 'left' | 'center' | 'right', paddingX: number): number {
    if (align === 'right') {
      return cellX + cellWidth - paddingX;
    }

    if (align === 'center') {
      return cellX + cellWidth / 2;
    }

    return cellX + paddingX;
  }

  private escapePdfText(input: string): string {
    return String(input ?? '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...');
  }

  private buildSummaryHtml(data: {
    title: string;
    meta?: Array<{ label: string; value: string }>;
    columns: Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string; noWrap?: boolean; maxLines?: number }>;
    rows: Array<Array<string>>;
    total?: { label: string; value: string };
  }): string {
    const headerColor = '#59b02d';
    const metaRows = (data.meta ?? [])
      .map(m => `
        <div style="display:table-row;">
          <div style="display:table-cell; width:140px; padding:8px 12px; font-weight:700; color:#2f3a2f; vertical-align:top; border-bottom:1px solid #dfe7da;">${this.escapeHtml(m.label)}</div>
          <div style="display:table-cell; padding:8px 12px; color:#202020; vertical-align:top; border-bottom:1px solid #dfe7da;">${this.escapeHtml(m.value)}</div>
        </div>
      `)
      .join('');

    const headerCells = data.columns
      .map(col => {
        const align = col.align ?? 'left';
        const width = col.width ? `width:${col.width};` : '';
        return `
          <th style="${width} text-align:${align}; padding:12px 14px; border:1px solid #9fcd8a; background:${headerColor}; color:#ffffff; font-weight:700; font-size:13px; line-height:1.2;">${this.escapeHtml(col.label)}</th>
        `;
      })
      .join('');

    const bodyRows = data.rows
      .map((row, rowIndex) => {
        const rowBackground = rowIndex % 2 === 0 ? '#ffffff' : '#f7fbf3';
        const cells = row.map((cell, idx) => {
          const col = data.columns[idx] ?? {};
          const align = col.align ?? 'left';
          const width = col.width ? `width:${col.width};` : '';
          const noWrap = col.noWrap ? 'white-space:nowrap;' : '';
          const maxLines = col.maxLines ? `display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:${col.maxLines}; overflow:hidden;` : '';
          const wordBreak = col.noWrap ? '' : 'word-break:break-word; overflow-wrap:anywhere;';
          return `
            <td style="${width} text-align:${align}; padding:12px 14px; border:1px solid #d8e5d0; background:${rowBackground}; font-size:13px; line-height:1.3; vertical-align:top; ${noWrap} ${wordBreak} ${maxLines}">${this.escapeHtml(cell ?? '')}</td>
          `;
        }).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const totalRow = data.total
      ? `
        <tr>
          <td colspan="${Math.max(1, data.columns.length)}" style="text-align:right; padding:14px; border:1px solid #b8d9a7; font-weight:700; font-size:16px; background:#edf7e6; color:#1d3515; word-break:break-word; overflow-wrap:anywhere;">
            ${this.escapeHtml(`${data.total.label}: ${data.total.value}`)}
          </td>
        </tr>
      `
      : '';

    return `
      <div style="font-family: Arial, sans-serif; color:#222; width:100%; box-sizing:border-box; padding:18px 22px 22px; background:#ffffff;">
        <div style="width:100%; box-sizing:border-box; padding:16px 18px; margin-bottom:18px; background:${headerColor}; color:#ffffff; border-radius:8px;">
          <div style="font-size:24px; font-weight:700; line-height:1.2; margin:0;">${this.escapeHtml(data.title)}</div>

        </div>
        ${metaRows ? `
          <div style="display:table; width:100%; table-layout:fixed; margin-bottom:18px; font-size:13px; border:1px solid #dfe7da; border-radius:8px; overflow:hidden; background:#fbfdf9;">
            ${metaRows}
          </div>
        ` : ''}
        <table style="border-collapse:collapse; width:100%; table-layout:fixed; font-size:13px;">
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>
            ${bodyRows}
            ${totalRow}
          </tbody>
        </table>
      </div>
    `;
  }

  private escapeHtml(input: string): string {
    return String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  generateWithPdfMake(content: any) {
    return pdfMake.createPdf({ content });
  }

    openPdf(pdf: string) {
    //window.open(pdf, '_blank');
    this.fileOpener.open(pdf, 'application/pdf')
      .then(() => console.log('PDF abierto'))
      .catch(e => console.log('Error abriendo PDF', e));
  }

  async savePdf(
    base64: string,
    fileName = 'document.pdf',
    directory: Directory = Directory.External,
  ) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory,
    }).then(res => res).catch(err => {
      console.error('Error saving PDF file:', err);
      throw err;
    });
    return result;
  }

  deletePdf(fileName: string, directory: Directory = Directory.External) {
    return Filesystem.deleteFile({
      path: fileName,
      directory,
    });
  }

  private drawEnterpriseLogo(
    doc: jsPDF,
    logoBase64: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ): boolean {
    try {
      const format = this.resolveJsPdfImageFormat(logoBase64);
      if (!format) {
        return false;
      }
      doc.addImage(logoBase64, format, x, y, maxWidth, maxHeight);
      return true;
    } catch (err) {
      console.warn('[drawEnterpriseLogo] unsupported logo format', err);
      return false;
    }
  }

  private resolveJsPdfImageFormat(logoBase64: string): 'PNG' | 'JPEG' | null {
    const value = String(logoBase64 || '').toLowerCase();
    if (value.includes('image/jpeg') || value.includes('image/jpg')) {
      return 'JPEG';
    }
    if (value.includes('image/png') || value.startsWith('data:image/png')) {
      return 'PNG';
    }
    if (value.includes('image/gif') || value.includes('image/svg') || value.includes('image/webp')) {
      return null;
    }
    // fallback: intentar PNG (muchos logos llegan sin mime claro)
    return 'PNG';
  }
}

