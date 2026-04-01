import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';

import AddCustomerModal from '../AddCustomerModal';

describe('AddCustomerModal', () => {
  it('renders modal and closes when Cancel is clicked', () => {
    render(<AddCustomerModal vendorId="test-vendor" />);

    // Open the modal by clicking the trigger button (role=button, name=+ Add Customer)
    const trigger = screen.getByRole('button', { name: /\+ add customer/i });
    act(() => {
      trigger.click();
    });

    // Modal should now be open (look for heading)
    expect(screen.getByRole('heading', { name: /add customer/i })).toBeInTheDocument();

    // Find the Cancel button by role and name
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    act(() => {
      cancelBtn.click();
    });

    // Modal should close (trigger button visible again)
    expect(screen.getByRole('button', { name: /\+ add customer/i })).toBeInTheDocument();
  });
});
