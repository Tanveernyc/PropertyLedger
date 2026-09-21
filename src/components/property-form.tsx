// Shared property create/edit form (Phase 3). The caller supplies initial values
// and receives the validated NewProperty payload on save.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import type { NewProperty, Property, PropertyType } from '@/types';
import { ui } from '@/theme';
import {
  parsePriceInput,
  validateProperty,
  type PropertyValidation,
} from '@/lib/property-validation';
import { nounFor } from '@/lib/ledger-copy';

interface Props {
  /** Existing property when editing; undefined when creating. */
  initial?: Property;
  /** Called with a validated payload; the caller performs the insert/update. */
  onSubmit: (values: NewProperty) => void;
  submitting: boolean;
  submitLabel: string;
}

export function PropertyForm({ initial, onSubmit, submitting, submitLabel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [propertyType, setPropertyType] = useState<PropertyType>(
    initial?.property_type ?? 'rental'
  );
  const [address, setAddress] = useState(initial?.address ?? '');
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? '');
  const [priceText, setPriceText] = useState(
    initial?.purchase_price != null ? String(initial.purchase_price) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<PropertyValidation['errors'] & { price?: string }>({});

  const isRental = propertyType === 'rental';

  const submit = () => {
    const validation = validateProperty({ name, property_type: propertyType });
    const price = parsePriceInput(priceText);
    const nextErrors: typeof errors = { ...validation.errors };
    if (isRental && price === undefined) nextErrors.price = 'Price must be a positive number.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      property_type: propertyType,
      address: isRental ? address.trim() || null : null,
      purchase_date: isRental ? purchaseDate.trim() || null : null,
      purchase_price: isRental ? price ?? null : null,
      notes: notes.trim() || null,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      // Scroll the focused field (and the Save button) above the keyboard instead of hiding them.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Text style={styles.label}>What is this ledger for? *</Text>
      <ScrollView horizontal contentContainerStyle={styles.typeRow}>
        {(
          [
            ['rental', 'Rental property'],
            ['personal', 'Personal budget'],
          ] as const
        ).map(([type, label]) => (
          <Pressable
            key={type}
            style={[styles.typeChip, propertyType === type && styles.typeChipActive]}
            onPress={() => setPropertyType(type)}
          >
            <Text style={propertyType === type ? styles.typeChipTextActive : styles.typeChipText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {errors.property_type ? <Text style={styles.error}>{errors.property_type}</Text> : null}

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={propertyType === 'personal' ? 'e.g. Household' : 'e.g. 12 Maple St'}
        accessibilityLabel={`${nounFor(propertyType).one} name`}
      />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      {isRental ? (
        <>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Street, city, state"
          />

          <Text style={styles.label}>Purchase date</Text>
          <TextInput
            style={styles.input}
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Purchase price ($)</Text>
          <TextInput
            style={styles.input}
            value={priceText}
            onChangeText={setPriceText}
            placeholder="e.g. 250000"
            keyboardType="decimal-pad"
          />
          {errors.price ? <Text style={styles.error}>{errors.price}</Text> : null}
        </>
      ) : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Saving…' : submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 6, paddingBottom: 48 },
  label: { ...ui.label },
  input: { ...ui.input, fontSize: 16 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { gap: 8 },
  typeChip: { ...ui.chip, paddingHorizontal: 16 },
  typeChipActive: { ...ui.chipActive },
  typeChipText: { ...ui.chipText, fontSize: 14 },
  typeChipTextActive: { ...ui.chipTextActive, fontSize: 14 },
  error: { ...ui.error, fontSize: 13 },
  button: { ...ui.buttonPrimary, marginTop: 20 },
  buttonText: { ...ui.buttonPrimaryText },
});
