// Dashboard tab (Phase 11): portfolio net this year, per-property mini P&L,
// five most recent transactions, quick-add. Math in src/lib/dashboard.ts;
// presentation in src/components/dashboard-view.tsx.
import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardView } from '@/components/dashboard-view';
import { useSession } from '@/components/session-provider';
import { listCategories } from '@/db/categories';
import { listAllExpenses } from '@/db/expenses';
import { listAllIncome } from '@/db/income';
import { listProperties } from '@/db/properties';
import { supabase } from '@/db/supabase';
import { buildDashboardModel } from '@/lib/dashboard';
import { todayISO } from '@/lib/dates';

export default function DashboardScreen() {
  const { session } = useSession();

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: true }],
    queryFn: () => listProperties({ includeArchived: true }),
  });
  const { data: expenses } = useQuery({ queryKey: ['expenses', 'all'], queryFn: listAllExpenses });
  const { data: income } = useQuery({ queryKey: ['income', 'all'], queryFn: listAllIncome });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const model = buildDashboardModel(properties ?? [], expenses ?? [], income ?? [], todayISO());
  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <View style={styles.container}>
      <DashboardView
        model={model}
        categoryNames={categoryNames}
        onQuickAdd={() => router.push('/add')}
        onOpenProperty={(id) => router.push({ pathname: '/property/[id]', params: { id } })}
        onOpenTransaction={(entry) =>
          router.push({
            pathname: '/transaction/[kind]/[id]',
            params: { kind: entry.kind, id: entry.id },
          })
        }
      />
      <View style={styles.footer}>
        <Text style={styles.footerText}>{session?.user.email}</Text>
        <View style={styles.footerLinks}>
          <Link href="/categories" style={styles.link}>
            Categories
          </Link>
          <Link href="/export" style={styles.link}>
            Export
          </Link>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 12, color: '#999' },
  footerLinks: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  link: { color: '#2563eb', fontSize: 13 },
  signOut: { color: '#c0392b', fontSize: 13 },
});
