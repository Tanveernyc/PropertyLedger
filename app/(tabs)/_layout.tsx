// Tab group layout. Mounting this group means the user is signed in (root layout
// guards it), so it is also where the recurring catch-up runs once per launch
// (README §4.2): post any months that became due since the app last opened.
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import { syncRecurringEntries } from '@/db/recurring';
import { colors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Outline glyph when idle, filled when this tab is selected. */
function tabIcon(idle: IconName, active: IconName) {
  return ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : idle} color={color} size={size} />
  );
}

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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brass,
        tabBarInactiveTintColor: colors.mist,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline', 'grid') }}
      />
      <Tabs.Screen
        name="properties"
        options={{ title: 'Properties', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="add"
        options={{ title: 'Add', tabBarIcon: tabIcon('add-circle-outline', 'add-circle') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: tabIcon('bar-chart-outline', 'bar-chart') }}
      />
    </Tabs>
  );
}
