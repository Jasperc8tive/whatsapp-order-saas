import '@testing-library/jest-dom';

import { render, screen, fireEvent } from '@testing-library/react';
import DownloadCustomersButton from '../DownloadCustomersButton';

describe('DownloadCustomersButton', () => {
  it('renders and triggers download on click', () => {
    const customers = [
      { id: '1', name: 'John Doe', phone: '1234567890', created_at: new Date().toISOString() }
    ];
    render(<DownloadCustomersButton customers={customers} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    // Optionally: check that a link is created, or mock URL.createObjectURL if needed
  });
});
