import axios, { AxiosInstance, AxiosError } from 'axios';

export class CFApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(`CloudFuze API ${statusCode}: ${message}`);
    this.name = 'CFApiError';
  }
}

/**
 * HTTP client for the CloudFuze Java backend REST API.
 * All confirmed endpoints from the production Swagger spec.
 */
export class CloudFuzeClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, token: string) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Retry on 429 and 5xx (up to 3 times with backoff)
    this.http.interceptors.response.use(undefined, this.retryInterceptor.bind(this));
  }

  private retryCount = new WeakMap<object, number>();

  private async retryInterceptor(error: AxiosError): Promise<any> {
    const config = error.config as any;
    if (!config) throw error;

    const count = this.retryCount.get(config) ?? 0;
    const retryable = [429, 500, 502, 503, 504];
    const statusCode = error.response?.status ?? 0;

    if (count < 3 && retryable.includes(statusCode)) {
      this.retryCount.set(config, count + 1);
      const delay = Math.pow(2, count) * 500;
      await new Promise((r) => setTimeout(r, delay));
      return this.http.request(config);
    }

    const msg = (error.response?.data as any)?.message ?? error.message;
    throw new CFApiError(statusCode, msg);
  }

  private async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const { data } = await this.http.get<T>(path, { params });
    return data;
  }

  private async post<T>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    const { data } = await this.http.post<T>(path, body, { params });
    return data;
  }

  private async put<T>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    const { data } = await this.http.put<T>(path, body, { params });
    return data;
  }

  private async delete<T>(path: string, params?: Record<string, any>): Promise<T> {
    const { data } = await this.http.delete<T>(path, { params });
    return data;
  }

  // ── Vendors ──────────────────────────────────────────────────────────────

  getConnectedVendors() {
    return this.get<any[]>('/api/vendor/list');
  }

  getVendorUserMetrics(adminMemberId: string) {
    return this.get<any>('/api/vendor/list/usermetrics', { adminMemberId });
  }

  getVendorUsers() {
    return this.get<any[]>('/api/vendor/list/users');
  }

  // ── Users ────────────────────────────────────────────────────────────────

  getUsersList(adminMemberId?: string) {
    return this.get<any>('/api/common/users/list', adminMemberId ? { adminMemberId } : undefined);
  }

  getUsersByOrg(adminCloudId: string) {
    return this.get<any[]>(`/api/common/get/users/${adminCloudId}`);
  }

  preRegisterUser(payload: {
    email: string;
    vendor: string;
    adminMemberId: string;
    firstName?: string;
    lastName?: string;
  }) {
    const username = payload.email.split('@')[0];
    const body = [{
      email: username,
      vendor: payload.vendor,
      adminMemberId: payload.adminMemberId,
      firstName: payload.firstName ?? username,
      lastName: payload.lastName ?? username,
      role: 'OTHER',
    }];
    return this.post<any>('/api/user/onBoard', body);
  }

  // ── Onboard Workflows ────────────────────────────────────────────────────

  /**
   * POST /api/workflow/onboard/create
   * Creates an onboard workflow entry (does not execute — use runOnboardWorkflow next).
   */
  createOnboardWorkflow(payload: {
    workflowName: string;
    vendor: string;
    adminCloudId: string;
    adminMemberId: string;
    sourceAdminCloudId?: string;
    users?: string[];
  }) {
    return this.post<any>('/api/workflow/onboard/create', payload);
  }

  /**
   * POST /api/user/onBoard/users/runFlow
   * Executes the onboarding — provisions a user in the target SaaS app.
   */
  runOnboardWorkflow(payload: {
    email: string;
    displayName: string;
    vendor: string;
    adminMemberId: string;
    adminCloudId: string;
    existingAdminCloudId?: string;
  }) {
    const username = payload.email.split('@')[0];
    const body = [{
      email: username,
      displayName: payload.displayName ?? payload.email,
      name: null,
      firstName: null,
      lastName: null,
      passWord: null,
      changePasswordAtNextLogin: true,
      alternateEmail: null,
      vendor: payload.vendor,
      role: 'OTHER',
      subscriptionsCount: 0,
      subIds: [],
      adminMemberId: payload.adminMemberId,
      adminCloudId: payload.adminCloudId,
      existingUser: true,
      existingAdminCloudId: payload.existingAdminCloudId ?? payload.adminCloudId,
      existingMemberId: payload.displayName ?? payload.email,
      deleted: false,
      saaSApplicationRoles: [],
    }];
    return this.post<any>('/api/user/onBoard/users/runFlow', body);
  }

  // ── Offboard Workflows ───────────────────────────────────────────────────

  /**
   * POST /api/workflow/create/offboardworkflow
   * Creates an offboard workflow (requires approval before execution).
   */
  createOffboardWorkflow(payload: {
    workflowName: string;
    apps: Array<{ vendor: string }>;
    users: Array<{ email: string }>;
  }) {
    return this.post<any>('/api/workflow/create/offboardworkflow', payload);
  }

  /**
   * POST /api/user/offBoard/runFlow
   * Executes offboard — deprovisions a user from a SaaS app.
   */
  runOffboardWorkflow(payload: {
    adminCloudId: string;
    email: string;
    vendor: string;
    permDelete?: boolean;
  }) {
    const body = {
      adminMemberId: payload.adminCloudId, // offboard uses MongoDB _id here
      email: payload.email,
      vendor: payload.vendor,
      adminCloudId: payload.adminCloudId,
    };
    return this.post<any>(
      `/api/user/offBoard/runFlow?permDelete=${payload.permDelete ? 'true' : 'false'}`,
      body
    );
  }

  /**
   * PUT /api/workflow/offboarddetails/update
   * Approve or reject a pending offboard workflow.
   */
  approveOffboardWorkflow(workflowId: string, approveStatus: 'APPROVED' | 'REJECTED') {
    return this.put<any>('/api/workflow/offboarddetails/update', undefined, {
      workflowId,
      approveStatus,
    });
  }

  // ── Conditional Workflows ────────────────────────────────────────────────

  createConditionalWorkflow(payload: {
    workflowName: string;
    vendor: string;
    condition: string;
  }) {
    return this.post<any>('/api/workflow/create/conditionalWorkFlows', payload);
  }

  // ── Workflow Management ──────────────────────────────────────────────────

  listOffboardWorkflows() {
    return this.get<any>('/api/workflow/get/workflows');
  }

  listOnboardWorkflows() {
    return this.get<any>('/api/workflow/onboard');
  }

  getWorkflowDetails(workflowId: string) {
    return this.get<any>(`/api/workflow/get/workflowsdetails/${workflowId}`);
  }

  getOnboardDetails(workflowOnBoardDetailsId: string) {
    return this.get<any>(`/api/workflow/get/onboarddetails/${workflowOnBoardDetailsId}`);
  }

  getOffboardDetails(workflowId: string) {
    return this.get<any>(`/api/workflow/get/offboarddetails/${workflowId}`);
  }

  getOffboardApps(workflowOffBoardId: string) {
    return this.get<any>(`/api/workflow/offBoardApps/${workflowOffBoardId}`);
  }

  deleteWorkflow(workflowId: string, isOffboard = false) {
    return this.delete<any>(`/api/workflow/delete/${workflowId}`, {
      isOffboardingWorkflow: isOffboard.toString(),
    });
  }

  // ── Licenses / Subscriptions ─────────────────────────────────────────────

  getSubscriptions(adminCloudId: string) {
    return this.get<any[]>(`/api/license-config/subscriptions/${adminCloudId}`);
  }

  getLicenseDetails(adminCloudId: string) {
    return this.get<any>(`/api/license-config/getcflicencedetails/${adminCloudId}`);
  }

  getAllLicenseVendors() {
    return this.get<any[]>('/api/domainlicense/getalllicensevendor');
  }

  getLicenseMetricsSummary() {
    return this.get<any>('/api/license-metrics/summary');
  }

  getLicenseOptimizationSuggestions() {
    return this.get<any[]>('/api/license-metrics/optimization-suggestions');
  }

  // ── Approved Apps ────────────────────────────────────────────────────────

  getApprovedApps() {
    return this.get<any[]>('/api/approved-apps/search');
  }

  // ── Shadow IT ────────────────────────────────────────────────────────────

  getShadowLogs() {
    return this.get<any[]>('/api/getallShadowLogs');
  }

  getShadowIT(page = 0, size = 1000) {
    return this.get<any>('/api/common/shadowIT', { page, size });
  }

  // ── Renewals ─────────────────────────────────────────────────────────────

  getRenewalVendors() {
    return this.get<any[]>('/api/renewal/vendors');
  }

  getRenewalExpirationInfo() {
    return this.get<any[]>('/api/renewal/vendors/expirationInfo');
  }
}

// Singleton — one client per process
let _client: CloudFuzeClient | null = null;

export function getCFClient(): CloudFuzeClient {
  if (!_client) {
    const baseUrl = process.env.CLOUDFUZE_BASE_URL;
    const token = process.env.CLOUDFUZE_TOKEN;
    if (!baseUrl || !token) {
      throw new Error('CLOUDFUZE_BASE_URL and CLOUDFUZE_TOKEN must be set');
    }
    _client = new CloudFuzeClient(baseUrl, token);
  }
  return _client;
}
