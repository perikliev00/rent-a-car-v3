/**
 * Car detail tabs host: overview, service, damage, docs, compliance, performance.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link, useParams } from 'react-router-dom';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../utils/format'.
import { imageUrl } from '../../utils/format';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../auth/permissions'.
import { hasPermission } from '../../auth/permissions';
// Import named exports from './carDetail/CarComplianceTab'.
import { CarComplianceTab } from './carDetail/CarComplianceTab';
// Import named exports from './carDetail/CarDamageTab'.
import { CarDamageTab } from './carDetail/CarDamageTab';
// Import named exports from './carDetail/CarDocumentsTab'.
import { CarDocumentsTab } from './carDetail/CarDocumentsTab';
// Import named exports from './carDetail/CarOverviewTab'.
import { CarOverviewTab } from './carDetail/CarOverviewTab';
// Import named exports from './carDetail/CarPerformanceTab'.
import { CarPerformanceTab } from './carDetail/CarPerformanceTab';
// Import named exports from './carDetail/CarServiceTab'.
import { CarServiceTab } from './carDetail/CarServiceTab';
// Import named exports from './carDetail/carDetailTypes'.
import { statusChipClass, type Tab } from './carDetail/carDetailTypes';
// Import named exports from './carDetail/useAdminCarDetailData'.
import { useAdminCarDetailData } from './carDetail/useAdminCarDetailData';

/** Car detail tabs host: overview, service, damage, docs, compliance, performance. */
export function AdminCarDetailPage() {
  // Destructure object properties into local variables.
  const { id = '' } = useParams();
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the can money constant.
  const canMoney = hasPermission(user, 'can_view_revenue');
  // Destructure array values into local variables.
  const [tab, setTab] = useState<Tab>('overview');

  // Create the data constant.
  const data = useAdminCarDetailData({ id, tab });
  // Destructure object properties into local variables.
  const { car, carQuery } = data;

  if (carQuery.isLoading) return <PageLoader />;
  // Evaluate the condition and enter the branch when it is true.
  if (carQuery.isError || !car) {
    // Return control to the caller with the following value.
    return (
      <div className="min-w-0">
        <Link to="/admin/cars" className="text-sm text-[var(--color-muted)] hover:underline">
          ← Cars
        </Link>
        <p className="mt-4 break-words text-[var(--color-danger)]">
          {(carQuery.error as Error)?.message || 'Car not found'}
        </p>
      </div>
    );
  }

  // Continue the surrounding logic with this statement.
  const tabs: { key: Tab; label: string }[] = [
    // Contribute this line to the enclosing declaration or statement.
    { key: 'overview', label: 'Overview' },
    // Contribute this line to the enclosing declaration or statement.
    { key: 'compliance', label: 'Compliance' },
    // Contribute this line to the enclosing declaration or statement.
    { key: 'service', label: 'Service' },
    // Contribute this line to the enclosing declaration or statement.
    { key: 'damage', label: 'Damage' },
    // Contribute this line to the enclosing declaration or statement.
    { key: 'documents', label: 'Documents' },
    // Contribute this line to the enclosing declaration or statement.
    { key: 'performance', label: 'Performance' },
  ];

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <Link to="/admin/cars" className="text-sm text-[var(--color-muted)] hover:underline">
        ← Cars
      </Link>
      <div className="mt-4 flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
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
