// Tab group layout. Tabs appear as their phases land: Dashboard (Phase 2 placeholder),
// Properties (Phase 3); add / reports arrive in Phases 5 and 8 (spec §4).
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="properties" options={{ title: 'Properties' }} />
    </Tabs>
  );
}
