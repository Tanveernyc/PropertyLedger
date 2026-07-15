// Phase 3 tests — property create/edit validation (spec §5 Phase 3):
// name required; type must be rental|personal.
import { parsePriceInput, validateProperty } from '../src/lib/property-validation';

describe('validateProperty', () => {
  it('requires a name', () => {
    const result = validateProperty({ name: '', property_type: 'rental' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rejects a whitespace-only name', () => {
    expect(validateProperty({ name: '   ', property_type: 'rental' }).valid).toBe(false);
  });

  it('requires type to be rental or personal', () => {
    for (const bad of ['', 'condo', 'RENTAL', 'commercial']) {
      const result = validateProperty({ name: '12 Maple St', property_type: bad });
      expect(result.valid).toBe(false);
      expect(result.errors.property_type).toBeDefined();
    }
  });

  it('accepts both valid types', () => {
    expect(validateProperty({ name: '12 Maple St', property_type: 'rental' }).valid).toBe(true);
    expect(validateProperty({ name: 'Home', property_type: 'personal' }).valid).toBe(true);
  });
});

describe('parsePriceInput', () => {
  it('treats empty input as null (price is optional)', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('   ')).toBeNull();
  });

  it('rejects non-numeric and non-positive input', () => {
    for (const bad of ['abc', '-5', '0', '12x']) {
      expect(parsePriceInput(bad)).toBeUndefined();
    }
  });

  it('parses valid prices', () => {
    expect(parsePriceInput('250000')).toBe(250000);
    expect(parsePriceInput('99.99')).toBe(99.99);
  });
});
