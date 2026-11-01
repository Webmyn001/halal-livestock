import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../common/Alert';
import { Spinner } from '../common/Button';
import { ApiRequestError } from '../../services/apiClient';
import { supportService } from '../../services/supportService';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_STYLES } from '../../utils/complaintMeta';
import { formatDateTime } from '../../utils/format';
import type { Complaint } from '../../types';

export function ReportsCard() {
  const [reports, setReports] = useState<Complaint[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supportService
      .listMine()
      .then((data) => {
        if (active) setReports(data);
      })
      .catch((err) => {
        if (!active) return;
        setFailure(err instanceof ApiRequestError ? err.message : 'Could not load your reports');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">Your reports</h2>
        <Link to="/contact" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Log a complaint
        </Link>
      </div>

      {failure ? (
        <div className="mt-4">
          <Alert tone="error">{failure}</Alert>
        </div>
      ) : null}

      {!failure && reports === null ? (
        <div className="flex items-center gap-3 py-6 text-sm text-ink-500">
          <Spinner className="size-4 text-brand-600" />
          Loading your reports
        </div>
      ) : null}

      {reports?.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-500">
          Nothing has been reported yet. If a listing, a payment or a delivery goes wrong, tell us and it lands here so
          you can follow the answer.
        </p>
      ) : null}

      {reports && reports.length > 0 ? (
        <ul className="mt-5 divide-y divide-stone-200">
          {reports.map((report) => (
            <li key={report.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{CATEGORY_LABELS[report.category]}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLES[report.status]}`}
                >
                  {STATUS_LABELS[report.status]}
                </span>
                <span className="ml-auto text-xs text-ink-500">{formatDateTime(report.createdAt)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-700">{report.message}</p>
              {report.adminResponse ? (
                <p className="mt-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm leading-relaxed text-brand-900">
                  <span className="font-semibold">Admin reply.</span> {report.adminResponse}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
