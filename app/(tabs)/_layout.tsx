// Tab group layout. Mounting this group means the user is signed in (root layout
// guards it), so it is also where the recurring catch-up runs once per launch
// (README §4.2): post any months that became due since the app last opened.
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { syncRecurringEntries } from '@/db/recurring';

export default function TabsLayout() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    syncRecurringEntries()
      .then((inserted) => {
        if (cancelled || inserted === 0) return;
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['income'] });
      })
      .catch((e: Error) => console.warn('recurring sync failed', e.message));
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="properties" options={{ title: 'Properties' }} />
      <Tabs.Screen name="add" options={{ title: 'Add' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
    </Tabs>
  );
}
