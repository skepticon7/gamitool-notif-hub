import { extractTemplateFields, interpolateTemplate } from './interpolate-template';

describe('interpolateTemplate', () => {
  it('replaces a known field with its value', () => {
    expect(interpolateTemplate('Hi {{name}}', { name: 'Ana' })).toBe('Hi Ana');
  });

  it('renders an unresolved field as an empty string, not the literal token', () => {
    expect(interpolateTemplate('Hi {{name}}', {})).toBe('Hi ');
  });

  it('replaces every occurrence when the same field appears more than once', () => {
    expect(interpolateTemplate('{{name}} and {{name}} again', { name: 'Ana' })).toBe(
      'Ana and Ana again',
    );
  });
});

describe('extractTemplateFields', () => {
  it('extracts every field referenced, including duplicates (no de-dup)', () => {
    expect(extractTemplateFields('{{a}} and {{a}} and {{b}}')).toEqual(['a', 'a', 'b']);
  });

  it('returns an empty array when the template has no placeholders', () => {
    expect(extractTemplateFields('just plain text')).toEqual([]);
  });
});
