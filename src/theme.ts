// Design tokens - the only place colours, type sizes, and radii are defined.
// Direction: a trustworthy paper ledger. Ink for words and money, brass for
// the few things you can tap, everything else quiet. Light mode only for now;
// keeping every value here means dark mode is a second object, not a rewrite.
import { StyleSheet, type TextStyle } from 'react-native';

export const colors = {
  ink: '#14213D',
  slate: '#5B6474',
  mist: '#8B94A5',
  line: '#E4E7EC',
  paper: '#F4F5F7',
  card: '#FFFFFF',
  brass: '#A9701A',
  brassSoft: '#FBF3E4',
  gain: '#1F7A4D',
  danger: '#A32D2D',
  dangerSoft: '#FBEAEA',
} as const;

export const radius = { card: 12, control: 10, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Type scale: one family (system), five sizes, weight does the work. */
export const type = {
  display: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.ink },
  label: { fontSize: 13, color: colors.slate },
  hint: { fontSize: 13, color: colors.mist },
} as const satisfies Record<string, TextStyle>;

/** Money is always set in tabular figures so a column of amounts lines up like a ledger. */
export const money: TextStyle = { fontVariant: ['tabular-nums'], fontWeight: '600', fontSize: 15, color: colors.ink };

/** Shared building blocks; screens compose these instead of re-declaring them. */
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
  },
  buttonPrimary: {
    backgroundColor: colors.ink,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPrimaryText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.brassSoft, borderColor: colors.brass },
  chipText: { color: colors.slate, fontSize: 13 },
  chipTextActive: { color: colors.brass, fontSize: 13, fontWeight: '600' },
  link: { color: colors.brass, fontSize: 14, fontWeight: '600' },
  label: { ...type.label, marginTop: space.md, marginBottom: space.xs },
  error: { color: colors.danger, fontSize: 12, marginTop: space.xs },
  empty: { textAlign: 'center', color: colors.mist, marginTop: 40, fontSize: 15 },
});
