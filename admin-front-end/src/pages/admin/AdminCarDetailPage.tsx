import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageLoader } from '../../components/ui/Loading';
import { imageUrl } from '../../utils/format';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/permissions';
import { CarComplianceTab } from './carDetail/CarComplianceTab';
import { CarDamageTab } from './carDetail/CarDamageTab';
import { CarDocumentsTab } from './carDetail/CarDocumentsTab';
import { CarOverviewTab } from './carDetail/CarOverviewTab';
import { CarPerformanceTab } from './carDetail/CarPerformanceTab';
import { CarServiceTab } from './carDetail/CarServiceTab';
import { statusChipClass, type Tab } from './carDetail/carDetailTypes';
import { useAdminCarDetailData } from './carDetail/useAdminCarDetailData';

export function AdminCarDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const canMoney = hasPermission(user, 'can_view_revenue');
  const [tab, setTab] = useState<Tab>('overview');

  const data = useAdminCarDetailData({ id, tab });
  const { car, carQuery } = data;

  if (carQuery.isLoading) return <PageLoader />;
  if (carQuery.isError || !car) {
    return (
      <div>
        <Link to="/admin/cars" className="text-sm text-[var(--color-muted)] hover:underline">
          ← Cars
        </Link>
        <p className="mt-4 text-[var(--color-danger)]">
          {(carQuery.error as Error)?.message || 'Car not found'}
        </p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'service', label: 'Service' },
    { key: 'damage', label: 'Damage' },
    { key: 'documents', label: 'Documents' },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <div>
      <Link to="/admin/cars" className="text-sm text-[var(--color-muted)] hover:underline">
        ← Cars
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {car.name}
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Fleet detail ·{' '}
            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${statusChipClass(car.status)}`}>
              {car.status || 'available'}
            </span>
          </p>
        </div>
        <img src={imageUrl(car.image)} alt="" className="h-20 w-32 rounded object-cover" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--color-line)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <CarOverviewTab
          car={car}
          fleetStatus={data.fleetStatus}
          setFleetStatus={data.setFleetStatus}
          overviewForm={data.overviewForm}
          setOverviewForm={data.setOverviewForm}
          statusMutationPending={data.statusMutation.isPending}
          overviewMutationPending={data.overviewMutation.isPending}
          onApplyStatus={() => data.statusMutation.mutate()}
          onSaveOverview={() => data.overviewMutation.mutate()}
        />
      )}

      {tab === 'compliance' && (
        <CarComplianceTab
          complianceForm={data.complianceForm}
          setComplianceForm={data.setComplianceForm}
          setComplianceFile={data.setComplianceFile}
          complianceMutationPending={data.complianceMutation.isPending}
          onAddCompliance={() => data.complianceMutation.mutate()}
          complianceLoading={data.complianceQuery.isLoading}
          items={data.complianceQuery.data?.items}
          onDownloadDocument={data.downloadComplianceDocument}
          onDeleteItem={data.deleteComplianceItem}
        />
      )}

      {tab === 'service' && (
        <CarServiceTab
          serviceForm={data.serviceForm}
          setServiceForm={data.setServiceForm}
          serviceMutationPending={data.serviceMutation.isPending}
          onAddService={() => data.serviceMutation.mutate()}
          serviceLoading={data.serviceQuery.isLoading}
          records={data.serviceQuery.data?.records}
          onDeleteRecord={data.deleteServiceRecord}
        />
      )}

      {tab === 'damage' && (
        <CarDamageTab
          damageForm={data.damageForm}
          setDamageForm={data.setDamageForm}
          setDamagePhotos={data.setDamagePhotos}
          damageMutationPending={data.damageMutation.isPending}
          onCreateReport={() => data.damageMutation.mutate()}
          damageLoading={data.damageQuery.isLoading}
          reports={data.damageQuery.data?.reports}
          onResolve={data.resolveDamage}
          onDelete={data.deleteDamage}
        />
      )}

      {tab === 'documents' && (
        <CarDocumentsTab
          docName={data.docName}
          setDocName={data.setDocName}
          setDocFile={data.setDocFile}
          docMutationPending={data.docMutation.isPending}
          onUpload={() => data.docMutation.mutate()}
          docsLoading={data.docsQuery.isLoading}
          documents={data.docsQuery.data?.documents}
          onDownload={data.downloadDocument}
          onDelete={data.deleteDocument}
        />
      )}

      {tab === 'performance' && (
        <CarPerformanceTab
          canMoney={canMoney}
          perfRange={data.perfRange}
          setPerfRange={data.setPerfRange}
          perfLoading={data.perfQuery.isLoading}
          perfError={data.perfQuery.isError ? (data.perfQuery.error as Error) : null}
          perfCar={data.perfQuery.data?.car}
        />
      )}
    </div>
  );
}
