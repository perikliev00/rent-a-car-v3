import type { Tab } from './carDetailTypes';
import { useCarCompliance } from './useCarCompliance';
import { useCarDamage } from './useCarDamage';
import { useCarDocuments } from './useCarDocuments';
import { useCarOverview } from './useCarOverview';
import { useCarPerformance } from './useCarPerformance';
import { useCarService } from './useCarService';

export function useAdminCarDetailData({ id, tab }: { id: string; tab: Tab }) {
  const overview = useCarOverview(id);
  const compliance = useCarCompliance(id, tab);
  const service = useCarService(id, tab);
  const damage = useCarDamage(id, tab);
  const documents = useCarDocuments(id, tab);
  const performance = useCarPerformance(id, tab);

  return {
    car: overview.car,
    carQuery: overview.carQuery,
    complianceQuery: compliance.complianceQuery,
    serviceQuery: service.serviceQuery,
    damageQuery: damage.damageQuery,
    docsQuery: documents.docsQuery,
    perfQuery: performance.perfQuery,
    perfRange: performance.perfRange,
    setPerfRange: performance.setPerfRange,
    fleetStatus: overview.fleetStatus,
    setFleetStatus: overview.setFleetStatus,
    overviewForm: overview.overviewForm,
    setOverviewForm: overview.setOverviewForm,
    serviceForm: service.serviceForm,
    setServiceForm: service.setServiceForm,
    damageForm: damage.damageForm,
    setDamageForm: damage.setDamageForm,
    damagePhotos: damage.damagePhotos,
    setDamagePhotos: damage.setDamagePhotos,
    docName: documents.docName,
    setDocName: documents.setDocName,
    docFile: documents.docFile,
    setDocFile: documents.setDocFile,
    complianceForm: compliance.complianceForm,
    setComplianceForm: compliance.setComplianceForm,
    complianceFile: compliance.complianceFile,
    setComplianceFile: compliance.setComplianceFile,
    statusMutation: overview.statusMutation,
    overviewMutation: overview.overviewMutation,
    serviceMutation: service.serviceMutation,
    damageMutation: damage.damageMutation,
    docMutation: documents.docMutation,
    complianceMutation: compliance.complianceMutation,
    deleteComplianceItem: compliance.deleteComplianceItem,
    deleteServiceRecord: service.deleteServiceRecord,
    resolveDamage: damage.resolveDamage,
    deleteDamage: damage.deleteDamage,
    deleteDocument: documents.deleteDocument,
  };
}
