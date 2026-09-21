// Modal: create a recurring rule. Reached from the Add tab ("Repeats every month?")
// and from a property's Recurring list. Params: kind (default expense), propertyId.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RecurringRuleForm } from '@/components/recurring-rule-form';
import type { CategoryKind } from '@/types';

export default function NewRecurringRuleScreen() {
  const { kind, propertyId } = useLocalSearchParams<{ kind?: CategoryKind; propertyId?: string }>();
  const resolvedKind: CategoryKind = kind === 'income' ? 'income' : 'expense';
  return (
    <>
      <Stack.Screen options={{ title: resolvedKind === 'expense' ? 'Recurring Expense' : 'Recurring Income' }} />
      <RecurringRuleForm kind={resolvedKind} initialPropertyId={propertyId} onSaved={() => router.back()} />
    </>
  );
}
