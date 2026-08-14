import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeCarFleetStatus,
  complianceTypeHasExpiry,
  createCarCompliance,
  createCarDamageReport,
  createCarServiceRecord,
  deleteCarCompliance,
  deleteCarDamageReport,
  deleteCarDocument,
  deleteCarServiceRecord,
  getAdminCar,
  getCarCompliance,
  getCarDamageReports,
  getCarDocuments,
  getCarServiceRecords,
  resolveCarDamageReport,
  updateAdminCar,
  uploadCarDocument,
} from '../../../api/admin/cars';
import { getCarPerformance } from '../../../api/admin/analytics';
import { toast } from '../../../components/ui/toastStore';
import type { CarFleetStatus } from '../../../types/api';
import {
  defaultPerfRange,
  type ComplianceForm,
  type DamageForm,
  type OverviewForm,
  type ServiceForm,
  type Tab,
} from './carDetailTypes';

export function useAdminCarDetailData({ id, tab }: { id: string; tab: Tab }) {
  const queryClient = useQueryClient();
  const [perfRange, setPerfRange] = useState(defaultPerfRange);
  const [fleetStatus, setFleetStatus] = useState<CarFleetStatus | ''>('');
  const [overviewForm, setOverviewForm] = useState<OverviewForm>({
    registrationNumber: '',
    vin: '',
    mileage: '',
    fuelLevel: '',
    currentLocation: '',
    insuranceExpiry: '',
    technicalInspectionExpiry: '',
  });
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    serviceType: 'oil_change',
    description: '',
    cost: '',
    mileage: '',
    serviceDate: '',
    nextServiceDate: '',
  });
  const [damageForm, setDamageForm] = useState<DamageForm>({
    description: '',
    reservationId: '',
    repairCost: '',
  });
  const [damagePhotos, setDamagePhotos] = useState<FileList | null>(null);
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [complianceForm, setComplianceForm] = useState<ComplianceForm>({
    itemType: 'civil_insurance',
    title: '',
    referenceNumber: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
    status: '',
  });
  const [complianceFile, setComplianceFile] = useState<File | null>(null);

  const carQuery = useQuery({
    queryKey: ['admin', 'cars', id],
    queryFn: () => getAdminCar(id),
    enabled: Boolean(id),
  });

  const complianceQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'compliance'],
    queryFn: () => getCarCompliance(id),
    enabled: Boolean(id) && tab === 'compliance',
  });

  const serviceQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'service'],
    queryFn: () => getCarServiceRecords(id),
    enabled: Boolean(id) && tab === 'service',
  });

  const damageQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'damage'],
    queryFn: () => getCarDamageReports(id),
    enabled: Boolean(id) && tab === 'damage',
  });

  const docsQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'documents'],
    queryFn: () => getCarDocuments(id),
    enabled: Boolean(id) && tab === 'documents',
  });

  const perfQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'performance', perfRange.from, perfRange.to],
    queryFn: () => getCarPerformance(id, perfRange.from, perfRange.to),
    enabled: Boolean(id) && tab === 'performance',
  });

  const car = carQuery.data?.car;

  useEffect(() => {
    if (!car) return;
    setOverviewForm({
      registrationNumber: car.registrationNumber ?? '',
      vin: car.vin ?? '',
      mileage: car.mileage != null ? String(car.mileage) : '',
      fuelLevel: car.fuelLevel ?? '',
      currentLocation: car.currentLocation ?? '',
      insuranceExpiry: car.insuranceExpiry ?? '',
      technicalInspectionExpiry: car.technicalInspectionExpiry ?? '',
    });
  }, [car]);

  const refreshCar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
  };

  const statusMutation = useMutation({
    mutationFn: () =>
      changeCarFleetStatus(id, { status: fleetStatus as CarFleetStatus, reason: 'admin_fleet_detail' }),
    onSuccess: () => {
      toast('Status updated', 'success');
      setFleetStatus('');
      refreshCar();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const overviewMutation = useMutation({
    mutationFn: async () => {
      if (!car) throw new Error('Car not found');
      const fd = new FormData();
      fd.append('name', car.name);
      fd.append('transmission', car.transmission);
      fd.append('fuelType', car.fuelType);
      fd.append('seats', String(car.seats));
      if (car.categoryId) fd.append('categoryId', String(car.categoryId));
      fd.append('priceTier_1_3', String(car.priceTier_1_3 ?? car.price ?? 0));
      if (car.priceTier_7_31 != null) fd.append('priceTier_7_31', String(car.priceTier_7_31));
      if (car.priceTier_31_plus != null) fd.append('priceTier_31_plus', String(car.priceTier_31_plus));
      if (car.status === 'available' || car.availability) fd.append('availability', 'on');
      if (car.status) fd.append('status', car.status);
      fd.append('registrationNumber', overviewForm.registrationNumber);
      fd.append('vin', overviewForm.vin);
      fd.append('mileage', overviewForm.mileage);
      fd.append('fuelLevel', overviewForm.fuelLevel);
      fd.append('currentLocation', overviewForm.currentLocation);
      fd.append('insuranceExpiry', overviewForm.insuranceExpiry);
      fd.append('technicalInspectionExpiry', overviewForm.technicalInspectionExpiry);
      return updateAdminCar(id, fd);
    },
    onSuccess: () => {
      toast('Fleet details saved', 'success');
      refreshCar();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const serviceMutation = useMutation({
    mutationFn: () =>
      createCarServiceRecord(id, {
        serviceType: serviceForm.serviceType,
        description: serviceForm.description || undefined,
        cost: serviceForm.cost || undefined,
        mileage: serviceForm.mileage || undefined,
        serviceDate: serviceForm.serviceDate,
        nextServiceDate: serviceForm.nextServiceDate || undefined,
      }),
    onSuccess: () => {
      toast('Service record added', 'success');
      setServiceForm({
        serviceType: 'oil_change',
        description: '',
        cost: '',
        mileage: '',
        serviceDate: '',
        nextServiceDate: '',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'service'] });
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const damageMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('description', damageForm.description);
      if (damageForm.reservationId) fd.append('reservationId', damageForm.reservationId);
      if (damageForm.repairCost) fd.append('repairCost', damageForm.repairCost);
      if (damagePhotos) {
        Array.from(damagePhotos).forEach((file) => fd.append('photos', file));
      }
      return createCarDamageReport(id, fd);
    },
    onSuccess: () => {
      toast('Damage report created', 'success');
      setDamageForm({ description: '', reservationId: '', repairCost: '' });
      setDamagePhotos(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      refreshCar();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const docMutation = useMutation({
    mutationFn: () => {
      if (!docFile) throw new Error('Select a file');
      const fd = new FormData();
      fd.append('file', docFile);
      if (docName) fd.append('name', docName);
      return uploadCarDocument(id, fd);
    },
    onSuccess: () => {
      toast('Document uploaded', 'success');
      setDocFile(null);
      setDocName('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'documents'] });
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const complianceMutation = useMutation({
    mutationFn: () => {
      const hasExpiry = complianceTypeHasExpiry(complianceForm.itemType);
      const fd = new FormData();
      fd.append('itemType', complianceForm.itemType);
      if (complianceForm.title) fd.append('title', complianceForm.title);
      if (complianceForm.referenceNumber) {
        fd.append('referenceNumber', complianceForm.referenceNumber);
      }
      if (hasExpiry) {
        if (complianceForm.issuedAt) fd.append('issuedAt', complianceForm.issuedAt);
        if (complianceForm.expiresAt) fd.append('expiresAt', complianceForm.expiresAt);
      }
      if (complianceForm.notes) fd.append('notes', complianceForm.notes);
      if (complianceForm.status === 'missing') fd.append('status', 'missing');
      if (complianceFile) fd.append('file', complianceFile);
      return createCarCompliance(id, fd);
    },
    onSuccess: () => {
      toast('Compliance item added', 'success');
      setComplianceForm({
        itemType: 'civil_insurance',
        title: '',
        referenceNumber: '',
        issuedAt: '',
        expiresAt: '',
        notes: '',
        status: '',
      });
      setComplianceFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fleet-alerts'] });
      refreshCar();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  async function deleteComplianceItem(itemId: number) {
    try {
      await deleteCarCompliance(id, itemId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fleet-alerts'] });
      refreshCar();
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteServiceRecord(recordId: number) {
    try {
      await deleteCarServiceRecord(id, recordId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'service'] });
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function resolveDamage(reportId: number) {
    try {
      await resolveCarDamageReport(id, reportId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      toast('Resolved', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteDamage(reportId: number) {
    try {
      await deleteCarDamageReport(id, reportId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'damage'] });
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteDocument(docId: number) {
    try {
      await deleteCarDocument(id, docId);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id, 'documents'] });
      toast('Deleted', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return {
    car,
    carQuery,
    complianceQuery,
    serviceQuery,
    damageQuery,
    docsQuery,
    perfQuery,
    perfRange,
    setPerfRange,
    fleetStatus,
    setFleetStatus,
    overviewForm,
    setOverviewForm,
    serviceForm,
    setServiceForm,
    damageForm,
    setDamageForm,
    damagePhotos,
    setDamagePhotos,
    docName,
    setDocName,
    docFile,
    setDocFile,
    complianceForm,
    setComplianceForm,
    complianceFile,
    setComplianceFile,
    statusMutation,
    overviewMutation,
    serviceMutation,
    damageMutation,
    docMutation,
    complianceMutation,
    deleteComplianceItem,
    deleteServiceRecord,
    resolveDamage,
    deleteDamage,
    deleteDocument,
  };
}
