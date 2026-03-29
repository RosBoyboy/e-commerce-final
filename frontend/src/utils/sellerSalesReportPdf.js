/**
 * Client-only: generates a minimalist UrbanNxt sales report (PHP / ₱).
 * Dynamic-import from a browser event so Next.js SSR does not load jspdf.
 */
function formatPhp(n) {
  const v = Number(n) || 0;
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function downloadSellerSalesReport({
  summary,
  bestSellers,
  generatedAtLabel,
  storeLabel = 'urbanNxt',
}) {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let y = margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(storeLabel, margin, y);
  y += 14;
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales report', margin, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${generatedAtLabel} · All amounts in PHP (₱)`, margin, y);
  y += 28;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total earnings (seller lines)', formatPhp(summary.earnings)],
      ['Orders', String(summary.orders)],
      ['Unique customers', String(summary.customers)],
      ['Active products (catalog)', String(summary.products)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 8, textColor: [51, 65, 85] },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    margin: { left: margin, right: margin },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Best sellers (units sold)', margin, y);
  y += 6;

  const sellerRows = (bestSellers || []).map((r) => [
    r.name || '—',
    String(r.units ?? 0),
    formatPhp(r.revenue ?? 0),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Product', 'Units sold', 'Revenue']],
    body: sellerRows.length ? sellerRows : [['—', '0', formatPhp(0)]],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 8, textColor: [51, 65, 85] },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    margin: { left: margin, right: margin },
  });

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'urbanNxt · Seller analytics export',
    margin,
    doc.internal.pageSize.getHeight() - 32,
  );

  doc.save(`urbanNxt-sales-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
