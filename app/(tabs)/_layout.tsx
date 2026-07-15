// Tab group layout. Phase 2 only needs a landing tab (Dashboard);
// properties / add / reports tabs arrive in their own phases (spec §4).
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
    </Tabs>
  );
}
