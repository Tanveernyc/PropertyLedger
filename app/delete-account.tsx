// Account deletion confirmation (Phase 13). Required by App Store Review
// Guideline 5.1.1(v). Deletion is immediate and permanent; the typed word is
// the only thing standing between a tap and unrecoverable data loss.
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { deleteAccount } from '@/db/account';
import { CONFIRM_WORD, isDeleteConfirmed } from '@/lib/delete-account';

export default function DeleteAccountScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canDelete = isDeleteConfirmed(confirmation) && !submitting;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: deleteError } = await deleteAccount();
    if (deleteError) {
      setSubmitting(false);
      setError(deleteError);
      return;
    }
    // Success: the session is gone, SessionProvider fires, and the root layout
    // guard routes to sign-in. Deliberately no setState here — this screen is
    // already unmounting.
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Delete your account</Text>

      <Text style={styles.body}>This permanently deletes:</Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Every property you have added</Text>
        <Text style={styles.listItem}>• Every expense and income record</Text>
        <Text style={styles.listItem}>• Your custom categories</Text>
        <Text style={styles.listItem}>• Your sign-in credentials</Text>
      </View>

      <Text style={styles.warning}>
        This cannot be undone and there is no way to recover your records afterwards. Export your
        data first if you want to keep a copy.
      </Text>

      <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
      <TextInput
        testID="confirmation-input"
        style={styles.input}
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!submitting}
        placeholder={CONFIRM_WORD}
        placeholderTextColor="#bbb"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        testID="delete-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canDelete }}
        disabled={!canDelete}
        onPress={submit}
        style={[styles.button, !canDelete && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Delete my account</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: '#111' },
  body: { fontSize: 15, color: '#333' },
  list: { gap: 4, paddingLeft: 4 },
  listItem: { fontSize: 15, color: '#333' },
  warning: { fontSize: 14, color: '#c0392b', lineHeight: 20 },
  label: { fontSize: 13, color: '#666', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  error: { color: '#c0392b', fontSize: 14 },
  button: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: '#e2b3ad' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
