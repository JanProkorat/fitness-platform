import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSignalR } from '@/hooks/useSignalR';

interface ComplianceUpdatedPayload {
  clientId?: string;
}

interface PlanPhotoUploadedPayload {
  planId?: string;
}

const sameId = (a: string | undefined, b: string) => a !== undefined && a.toLowerCase() === b.toLowerCase();

/**
 * Keeps one client's nutrition data live: refetches compliance, plans and photos when the
 * client logs a meal or uploads a plan photo. `clientId` is the route id, which is the
 * client's ClientProfile.PublicId, the same id the hub sends in `clientcomplianceupdated`.
 */
export function useClientNutritionRealtime(clientId: string) {
  const queryClient = useQueryClient();

  const refreshCompliance = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });
    void queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
    void queryClient.invalidateQueries({ queryKey: ['nutrition-plan-detail'] });
  }, [queryClient, clientId]);

  const refreshPhotos = useCallback(
    (planId?: string) => {
      void queryClient.invalidateQueries({
        queryKey: planId ? ['nutrition-plan-detail', planId] : ['nutrition-plan-detail'],
      });
      void queryClient.invalidateQueries({ queryKey: ['client-food-photos', clientId] });
      void queryClient.invalidateQueries({ queryKey: ['client-photos', clientId] });
    },
    [queryClient, clientId],
  );

  useSignalR(
    {
      clientcomplianceupdated: (payload) => {
        const data = payload as ComplianceUpdatedPayload | null;
        if (sameId(data?.clientId, clientId)) {
          refreshCompliance();
        }
      },
      // The event carries no client id, so the open page refreshes its own photo keys every time.
      planphotouploaded: (payload) => {
        refreshPhotos((payload as PlanPhotoUploadedPayload | null)?.planId);
      },
    },
    () => {
      refreshCompliance();
      refreshPhotos();
    },
  );
}
