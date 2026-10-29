import { usePayments } from '@/hooks/usePayments';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';

import type { CoveredCollaboration } from './collaborationRoles';
import { shownFirstPaymentIds } from './getReady';
import { PaymentDueCard } from './PaymentDueCard';
import type { AreaBlock } from './todayBlocks';

type AreaPaymentDueProps = {
  blocks: readonly AreaBlock[];
  covering: readonly CoveredCollaboration[];
};

/** Payment due for the area-blocks screen, leaving out the first payment Get ready already lists. */
export function AreaPaymentDue({ blocks, covering }: AreaPaymentDueProps) {
  const { enabled } = usePaymentsEnabled();
  const { data: coaches } = usePayments(enabled);
  return <PaymentDueCard excludePaymentIds={shownFirstPaymentIds(blocks, covering, coaches)} />;
}
