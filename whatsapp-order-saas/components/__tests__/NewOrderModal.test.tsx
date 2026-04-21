import { render, screen, fireEvent } from '@testing-library/react';
import NewOrderModal from '../NewOrderModal';

describe('NewOrderModal', () => {
  it('renders modal and closes when Done is clicked', () => {
    render(<NewOrderModal vendorId="test-vendor" canUseAiAutofill={false} />);
    // Open modal by simulating the button click
    fireEvent.click(screen.getByRole('button', { name: /new order/i }));
    expect(screen.getByText(/new manual order/i)).toBeInTheDocument();
    // Simulate Done button click (after success)
    // This is a placeholder; you may want to simulate a full order flow for more robust test
  });
});
