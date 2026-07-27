import { IApplicationDocument } from '../types';

const escapeCSV = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const generateCSVReport = (applications: IApplicationDocument[]): string => {
  const headers = [
    'Company',
    'Job Title',
    'Location',
    'Applied Date',
    'Status',
    'Source',
    'Salary Min',
    'Salary Max',
    'Currency',
    'Deadline',
    'Job URL',
    'Resume Version',
    'Interview Stages',
    'Notes',
  ];

  const rows = applications.map((app) => [
    escapeCSV(app.company),
    escapeCSV(app.jobTitle),
    escapeCSV(app.location ?? ''),
    escapeCSV(new Date(app.appliedDate).toLocaleDateString()),
    escapeCSV(app.status),
    escapeCSV(app.source ?? ''),
    escapeCSV(app.salaryMin ?? ''),
    escapeCSV(app.salaryMax ?? ''),
    escapeCSV(app.salaryCurrency ?? 'USD'),
    escapeCSV(app.deadline ? new Date(app.deadline).toLocaleDateString() : ''),
    escapeCSV(app.jobUrl ?? ''),
    escapeCSV(app.resumeVersion ?? ''),
    escapeCSV(app.interviewStages.length),
    escapeCSV(app.notes ?? ''),
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ];

  return csvLines.join('\n');
};
