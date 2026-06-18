import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Field from './Field';
import Input from './Input';
import Select from './Select';

describe('Field', () => {
  it('associates its label with a nested Input so the control is reachable by label text', () => {
    renderWithProviders(
      <Field label="Top N">
        <Input type="number" defaultValue={20} />
      </Field>,
    );
    const input = screen.getByLabelText('Top N') as HTMLInputElement;
    expect(input.value).toBe('20');
  });

  it('associates its label with a nested Select (role + accessible name)', () => {
    renderWithProviders(
      <Field label="Venue">
        <Select defaultValue="us">
          <option value="us">US</option>
        </Select>
      </Field>,
    );
    expect(screen.getByRole('combobox', { name: 'Venue' })).toBeInTheDocument();
  });

  it('renders a hint when provided', () => {
    renderWithProviders(
      <Field label="Top N" hint="max candidates">
        <Input />
      </Field>,
    );
    expect(screen.getByText('max candidates')).toBeInTheDocument();
  });

  it('renders an error in place of the hint', () => {
    renderWithProviders(
      <Field label="Top N" hint="max candidates" error="required">
        <Input />
      </Field>,
    );
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.queryByText('max candidates')).not.toBeInTheDocument();
  });
});
