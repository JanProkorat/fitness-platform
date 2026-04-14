import { useState } from 'react';

export function useConfirmDelete<TId = string>(
  deleteMutationResult: { mutate: (id: TId) => void; isPending: boolean },
) {
  const [target, setTarget] = useState<{ id: TId; name: string } | null>(null);

  return {
    target,
    isPending: deleteMutationResult.isPending,
    requestDelete: (id: TId, name: string) => setTarget({ id, name }),
    cancelDelete: () => setTarget(null),
    confirmDelete: () => {
      if (target) {
        deleteMutationResult.mutate(target.id);
        setTarget(null);
      }
    },
  };
}
