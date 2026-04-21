import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AssignmentBadge from '../AssignmentBadge';

describe('AssignmentBadge', () => {
  it('renders Unassigned when assignment is null', () => {
    render(<AssignmentBadge assignment={null} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
