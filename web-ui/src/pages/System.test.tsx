import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { messagesEn } from '@/i18n/messages.en';
import System from './System';

describe('System section', () => {
  it('renders the three system tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/system/pool']}>
        <Routes>
          <Route path="/system" element={<System />}>
            <Route index element={<Navigate to="/system/pool" replace />} />
            <Route path="pool" element={<div>Pool page</div>} />
            <Route path="datasources" element={<div>Data sources page</div>} />
            <Route path="strategy" element={<div>Strategy page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('link', { name: messagesEn.system.tabs.pool })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: messagesEn.system.tabs.datasources })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: messagesEn.system.tabs.strategy })
    ).toBeInTheDocument();
  });
});
