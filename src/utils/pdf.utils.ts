import PDFDocument from 'pdfkit';
import { IApplicationDocument } from '../types';

interface ReportData {
  userName: string;
  dateRange: { startDate: Date; endDate: Date };
  totalApplications: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  responseRate: number;
  offerRate: number;
  interviewRate: number;
  applications: IApplicationDocument[];
}

export const generatePDFReport = (data: ReportData): Buffer => {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc
    .fontSize(24)
    .fillColor('#4F46E5')
    .text('CareerTracker', { align: 'center' });

  doc
    .fontSize(16)
    .fillColor('#1F2937')
    .text('Job Search Report', { align: 'center' });

  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#6B7280')
    .text(
      `Generated for: ${data.userName}  |  Period: ${data.dateRange.startDate.toLocaleDateString()} – ${data.dateRange.endDate.toLocaleDateString()}`,
      { align: 'center' }
    );

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(1);

  // Summary Cards
  doc.fontSize(14).fillColor('#1F2937').text('Summary', { underline: true });
  doc.moveDown(0.5);

  const summaryItems = [
    ['Total Applications', String(data.totalApplications)],
    ['Response Rate', `${data.responseRate}%`],
    ['Interview Rate', `${data.interviewRate}%`],
    ['Offer Rate', `${data.offerRate}%`],
  ];

  summaryItems.forEach(([label, value]) => {
    doc
      .fontSize(11)
      .fillColor('#374151')
      .text(`${label ?? ''}:`, { continued: true })
      .fillColor('#4F46E5')
      .text(`  ${value ?? ''}`);
  });

  doc.moveDown(1);

  // Applications by Status
  doc.fontSize(14).fillColor('#1F2937').text('Applications by Status', { underline: true });
  doc.moveDown(0.5);

  const statuses = [
    'Applied',
    'Shortlisted',
    'Interview Scheduled',
    'Interview Completed',
    'Offer',
    'Rejected',
    'Withdrawn',
  ];

  statuses.forEach((status) => {
    const count = data.byStatus[status] ?? 0;
    if (count > 0) {
      doc
        .fontSize(11)
        .fillColor('#374151')
        .text(`${status}:`, { continued: true })
        .fillColor('#059669')
        .text(`  ${count}`);
    }
  });

  doc.moveDown(1);

  // Applications by Source
  if (Object.keys(data.bySource).length > 0) {
    doc.fontSize(14).fillColor('#1F2937').text('Applications by Source', { underline: true });
    doc.moveDown(0.5);

    Object.entries(data.bySource).forEach(([source, count]) => {
      doc
        .fontSize(11)
        .fillColor('#374151')
        .text(`${source}:`, { continued: true })
        .fillColor('#2563EB')
        .text(`  ${count}`);
    });

    doc.moveDown(1);
  }

  // Application List
  if (data.applications.length > 0) {
    doc.addPage();
    doc.fontSize(14).fillColor('#1F2937').text('Application Details', { underline: true });
    doc.moveDown(0.5);

    data.applications.forEach((app, index) => {
      if (doc.y > 700) doc.addPage();

      doc
        .fontSize(12)
        .fillColor('#4F46E5')
        .text(`${index + 1}. ${app.company} — ${app.jobTitle}`);

      doc.fontSize(10).fillColor('#6B7280');

      if (app.location) doc.text(`   Location: ${app.location}`);

      doc.text(
        `   Applied: ${new Date(app.appliedDate).toLocaleDateString()}  |  Status: ${app.status}`
      );

      if (app.source) doc.text(`   Source: ${app.source}`);

      if (app.salaryMin ?? app.salaryMax) {
        const salary = app.salaryMin && app.salaryMax
          ? `${app.salaryCurrency ?? 'USD'} ${app.salaryMin.toLocaleString()} – ${app.salaryMax.toLocaleString()}`
          : app.salaryMin
          ? `${app.salaryCurrency ?? 'USD'} ${app.salaryMin.toLocaleString()}+`
          : '';
        if (salary) doc.text(`   Salary: ${salary}`);
      }

      doc.moveDown(0.5);
    });
  }

  // Footer
  const pageCount = (doc as unknown as { _pageBuffer: unknown[] })._pageBuffer?.length ?? 1;
  doc
    .fontSize(8)
    .fillColor('#9CA3AF')
    .text(
      `CareerTracker Report  |  Generated on ${new Date().toLocaleDateString()}  |  Page 1 of ${pageCount}`,
      50,
      doc.page.height - 40,
      { align: 'center' }
    );

  doc.end();

  return Buffer.concat(chunks);
};
