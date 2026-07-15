// Shared property create/edit form (Phase 3). The caller supplies initial values
// and receives the validated NewProperty payload on save.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import type { NewProperty, Property, PropertyType } from '@/types';
import {
  parsePriceInput,
  PROPERTY_TYPES,
  validateProperty,
  type PropertyValidation,
} from '@/lib/property-validation';

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

  const submit = () => {
    const validation = validateProperty({ name, property_type: propertyType });
    const price = parsePriceInput(priceText);
    const nextErrors: typeof errors = { ...validation.errors };
    if (price === undefined) nextErrors.price = 'Price must be a positive number.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      property_type: propertyType,
      address: address.trim() || null,
      purchase_date: purchaseDate.trim() || null,
      purchase_price: price ?? null,
      notes: notes.trim() || null,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. 12 Maple St"
        accessibilityLabel="Property name"
      />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={styles.label}>Type *</Text>
      <ScrollView horizontal contentContainerStyle={styles.typeRow}>
        {PROPERTY_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.typeChip, propertyType === type && styles.typeChipActive]}
            onPress={() => setPropertyType(type)}
          >
            <Text style={propertyType === type ? styles.typeChipTextActive : styles.typeChipText}>
              {type}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {errors.property_type ? <Text style={styles.error}>{errors.property_type}</Text> : null}

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
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { gap: 8 },
  typeChip: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  typeChipActive: { backgroundColor: '#2563eb' },
  typeChipText: { color: '#2563eb' },
  typeChipTextActive: { color: '#fff' },
  error: { color: '#c0392b', fontSize: 13 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
