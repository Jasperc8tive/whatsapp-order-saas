import { render, screen, fireEvent } from '@testing-library/react';
import NewOrderModal from '../NewOrderModal';

describe('NewOrderModal', () => {
  it('renders modal and calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(<NewOrderModal open={true} onClose={onClose} />);
    expect(screen.getByText(/new order/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/cancel/i));
    expect(onClose).toHaveBeenCalled();
  });
});
