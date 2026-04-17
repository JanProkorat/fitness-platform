import { ApiClient } from './generated';
import { rawApi } from '@/lib/api';

// Use rawApi (transformResponse disabled) so NSwag's JSON.parse() works correctly.
// Auth interceptors (Bearer token + 401 refresh) are attached to rawApi.
export const apiClient = new ApiClient('', rawApi);

// Re-export all generated types for convenient imports
export type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  GetProfileResponse,
  UpdateProfileRequest,
  GetClientsRequest,
  GetClientsResponse,
  ClientSummary,
  InviteClientRequest,
  InviteClientResponse,
  GetClientDashboardRequest,
  GetClientDashboardResponse,
  LatestMeasurementDto,
  CreateCollaborationRequest,
  CreateCollaborationResponse,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  RequestPasswordResetRequest,
  ResetPasswordRequest,
} from './generated';

export { ApiException } from './generated';
