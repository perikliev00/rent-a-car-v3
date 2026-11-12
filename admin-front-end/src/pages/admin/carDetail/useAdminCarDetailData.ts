/**
 * Loads the car header/shared data for all detail tabs.
 */
import type { Tab } from './carDetailTypes';
// Import named exports from './useCarCompliance'.
import { useCarCompliance } from './useCarCompliance';
// Import named exports from './useCarDamage'.
import { useCarDamage } from './useCarDamage';
// Import named exports from './useCarDocuments'.
import { useCarDocuments } from './useCarDocuments';
// Import named exports from './useCarOverview'.
import { useCarOverview } from './useCarOverview';
// Import named exports from './useCarPerformance'.
import { useCarPerformance } from './useCarPerformance';
// Import named exports from './useCarService'.
import { useCarService } from './useCarService';

/**
 * Facade that composes all car-detail tab hooks into one page-facing object.
 * Tab-scoped hooks only fetch when their tab is active.
 *
 * @param id - Car id from the route
 * @param tab - Active detail tab
 */
export function useAdminCarDetailData({ id, tab }: { id: string; tab: Tab }) {
  // Create the overview constant.
  const overview = useCarOverview(id);
  // Create the compliance constant.
  const compliance = useCarCompliance(id, tab);
  // Create the service constant.
  const service = useCarService(id, tab);
  // Create the damage constant.
  const damage = useCarDamage(id, tab);
  // Create the documents constant.
  const documents = useCarDocuments(id, tab);
  // Create the performance constant.
  const performance = useCarPerformance(id, tab);

  // Return the resulting value to the caller.
  return {
    // Provide the car field value.
    car: overview.car,
    // Provide the car query field value.
    carQuery: overview.carQuery,
    // Provide the compliance query field value.
    complianceQuery: compliance.complianceQuery,
    // Provide the service query field value.
    serviceQuery: service.serviceQuery,
    // Provide the damage query field value.
    damageQuery: damage.damageQuery,
    // Provide the docs query field value.
    docsQuery: documents.docsQuery,
    // Provide the perf query field value.
    perfQuery: performance.perfQuery,
    // Provide the perf range field value.
    perfRange: performance.perfRange,
    // Provide the set perf range field value.
    setPerfRange: performance.setPerfRange,
    // Provide the fleet status field value.
    fleetStatus: overview.fleetStatus,
    // Provide the set fleet status field value.
    setFleetStatus: overview.setFleetStatus,
    // Provide the overview form field value.
    overviewForm: overview.overviewForm,
    // Provide the set overview form field value.
    setOverviewForm: overview.setOverviewForm,
    // Provide the service form field value.
    serviceForm: service.serviceForm,
    // Provide the set service form field value.
    setServiceForm: service.setServiceForm,
    // Provide the damage form field value.
    damageForm: damage.damageForm,
    // Provide the set damage form field value.
    setDamageForm: damage.setDamageForm,
    // Provide the damage photos field value.
    damagePhotos: damage.damagePhotos,
    // Provide the set damage photos field value.
    setDamagePhotos: damage.setDamagePhotos,
    // Provide the doc name field value.
    docName: documents.docName,
    // Provide the set doc name field value.
    setDocName: documents.setDocName,
    // Provide the doc file field value.
    docFile: documents.docFile,
    // Provide the set doc file field value.
    setDocFile: documents.setDocFile,
    // Provide the compliance form field value.
    complianceForm: compliance.complianceForm,
    // Provide the set compliance form field value.
    setComplianceForm: compliance.setComplianceForm,
    // Provide the compliance file field value.
    complianceFile: compliance.complianceFile,
    // Provide the set compliance file field value.
    setComplianceFile: compliance.setComplianceFile,
    // Provide the status mutation field value.
    statusMutation: overview.statusMutation,
    // Provide the overview mutation field value.
    overviewMutation: overview.overviewMutation,
    // Provide the service mutation field value.
    serviceMutation: service.serviceMutation,
    // Provide the damage mutation field value.
    damageMutation: damage.damageMutation,
    // Provide the doc mutation field value.
    docMutation: documents.docMutation,
    // Provide the compliance mutation field value.
    complianceMutation: compliance.complianceMutation,
    // Provide the delete compliance item field value.
    deleteComplianceItem: compliance.deleteComplianceItem,
    // Provide the delete service record field value.
    deleteServiceRecord: service.deleteServiceRecord,
    // Provide the resolve damage field value.
    resolveDamage: damage.resolveDamage,
    // Provide the delete damage field value.
    deleteDamage: damage.deleteDamage,
    // Provide the download document field value.
    downloadDocument: documents.downloadDocument,
    // Provide the delete document field value.
    deleteDocument: documents.deleteDocument,
    // Provide the download compliance document field value.
    downloadComplianceDocument: compliance.downloadComplianceDocument,
  };
}
