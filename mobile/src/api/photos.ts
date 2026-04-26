import api from './client'
import type {
  GetMyPhotosResponse,
  MonthGroupResponse,
  PlanPhotoResponse2,
} from './generated'
import { PlanPhotoCategory } from './generated'

// Re-export generated types so consumers only need to import from '@/api/photos'.
export { PlanPhotoCategory }
export type { GetMyPhotosResponse, MonthGroupResponse, PlanPhotoResponse2 }

export interface GetMyPhotosParams {
  page: number
  pageSize: number
  groupByMonth: boolean
  category?: PlanPhotoCategory | null
  from?: string | null
  to?: string | null
}

export interface GetMyPhotosPageResult {
  groups: MonthGroupResponse[]
  totalCount: number
  page: number
  pageSize: number
}

/**
 * Fetch the caller's cross-plan photo timeline.
 *
 * Always requests groupByMonth=true so the response contains
 * MonthGroupResponse objects ready for section-list rendering.
 * Pagination applies to month groups (one page = pageSize groups).
 *
 * The backend returns X-Total-Count for the total number of groups
 * (not total photos) when groupByMonth=true.
 */
export async function getMyPhotos(params: GetMyPhotosParams): Promise<GetMyPhotosPageResult> {
  const { data, headers } = await api.get<GetMyPhotosResponse>('/client/me/photos', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      groupByMonth: params.groupByMonth,
      ...(params.category != null ? { category: params.category } : {}),
      ...(params.from != null ? { from: params.from } : {}),
      ...(params.to != null ? { to: params.to } : {}),
    },
  })

  const rawTotal = headers['x-total-count']
  const totalCount = rawTotal != null ? parseInt(String(rawTotal), 10) : 0

  return {
    groups: data.groups ?? [],
    totalCount: isNaN(totalCount) ? 0 : totalCount,
    page: params.page,
    pageSize: params.pageSize,
  }
}
