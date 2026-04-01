import { render, screen } from '@testing-library/react';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  it('renders WhatsOrder logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('WhatsOrder')).toBeInTheDocument();
  });
});
