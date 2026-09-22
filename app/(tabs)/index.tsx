// Dashboard tab (Phase 11): portfolio net this year, per-property mini P&L,
// five most recent transactions, quick-add. Math in src/lib/dashboard.ts;
// presentation in src/components/dashboard-view.tsx.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardView } from '@/components/dashboard-view';
import { useSession } from '@/components/session-provider';
import { listCategories } from '@/db/categories';
import { listAllExpenses } from '@/db/expenses';
import { listAllIncome } from '@/db/income';
import { listProperties } from '@/db/properties';
import { supabase } from '@/db/supabase';
import { buildDashboardModel } from '@/lib/dashboard';
import { todayISO } from '@/lib/dates';
import { collectionTitle, kindsOf } from '@/lib/ledger-copy';
import { shouldOnboard } from '@/lib/onboarding';
import { colors, radius, ui } from '@/theme';

const SUPPORT_EMAIL = 'support@trueorganichub.com';
const SUPPORT_URL = 'https://tanveernyc.github.io/PropertyLedger/support.html';

/** Email first; if no mail app is set up, fall back to the support page. */
async function contactSupport() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=PropertyLedger%20support`;
  if (await Linking.canOpenURL(mailto)) return Linking.openURL(mailto);
  return Linking.openURL(SUPPORT_URL);
}

export default function DashboardScreen() {
  const { session } = useSession();

  const { data: properties, isFetching } = useQuery({
    queryKey: ['properties', { includeArchived: true }],
    queryFn: () => listProperties({ includeArchived: true }),
  });
  const { data: expenses } = useQuery({ queryKey: ['expenses', 'all'], queryFn: listAllExpenses });
  const { data: income } = useQuery({ queryKey: ['income', 'all'], queryFn: listAllIncome });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  // First run: a signed-in user with no ledgers (archived included) is sent to
  // the chooser instead of an empty dashboard. Onboarding invalidates
  // ['properties'] (refetchType 'all') on success, so the stale [] is refetched
  // even while this screen is unmounted; the isFetching guard covers the gap.
  useEffect(() => {
    if (shouldOnboard(properties, isFetching)) router.replace('/onboarding');
  }, [properties, isFetching]);

  const model = buildDashboardModel(properties ?? [], expenses ?? [], income ?? [], todayISO());
  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <View style={styles.container}>
      <DashboardView
        model={model}
        categoryNames={categoryNames}
        collectionTitle={collectionTitle(kindsOf(properties ?? []))}
        onQuickAdd={() => router.push('/add')}
        onOpenProperty={(id) => router.push({ pathname: '/property/[id]', params: { id } })}
        onOpenTransaction={(entry) =>
          router.push({
            pathname: '/transaction/[kind]/[id]',
            params: { kind: entry.kind, id: entry.id },
          })
        }
      />
      {/* Account actions: full-size buttons, not text links, so each is an easy tap. */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{session?.user.email}</Text>
        <View style={styles.footerRow}>
          <FooterButton label="Categories" onPress={() => router.push('/categories')} />
          <FooterButton label="Export" onPress={() => router.push('/export')} />
          <FooterButton label="Support" onPress={contactSupport} />
        </View>
        <View style={styles.footerRow}>
          <FooterButton label="Sign out" tone="danger" onPress={() => supabase.auth.signOut()} />
          <FooterButton label="Delete account" tone="danger" onPress={() => router.push('/delete-account')} />
        </View>
      </View>
    </View>
  );
}

function FooterButton({
  label,
  onPress,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.footerButtonText, tone === 'danger' && styles.footerButtonDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen },
  // Two lines: who is signed in, then the account actions - never fights for width.
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  footerText: { fontSize: 12, color: colors.mist },
  footerRow: { flexDirection: 'row', gap: 8 },
  // 44pt minimum height: Apple's comfortable tap target.
  footerButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 8,
  },
  footerButtonPressed: { backgroundColor: colors.line },
  footerButtonText: { color: colors.brass, fontSize: 14, fontWeight: '600' },
  footerButtonDanger: { color: colors.danger },
});
