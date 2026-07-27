import type {
  ComplaintDto,
  ComplaintReportsDto,
  ComplaintStaffOptionDto,
  CreateComplaintInput,
  RatingsOverviewDto,
  UpdateComplaintInput,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function listComplaints(): Promise<ComplaintDto[]> {
  const { data } = await api.get('/complaints');
  return data.data;
}

export async function listComplaintStaff(): Promise<ComplaintStaffOptionDto[]> {
  const { data } = await api.get('/complaints/staff');
  return data.data;
}

export async function getRatingsOverview(): Promise<RatingsOverviewDto> {
  const { data } = await api.get('/complaints/ratings');
  return data.data;
}

export async function getComplaintReports(months = 6): Promise<ComplaintReportsDto> {
  const { data } = await api.get('/complaints/reports', { params: { months } });
  return data.data;
}

export async function createComplaint(payload: CreateComplaintInput): Promise<ComplaintDto> {
  const { data } = await api.post('/complaints', payload);
  return data.data;
}

export async function updateComplaint(
  complaintId: string,
  payload: UpdateComplaintInput,
): Promise<ComplaintDto> {
  const { data } = await api.patch(`/complaints/${complaintId}`, payload);
  return data.data;
}
