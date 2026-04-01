import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import VideoCard from '../VideoCard';

describe('VideoCard', () => {
  it('renders title, description, and thumbnail', () => {
    render(
      <VideoCard
        title="Test Video"
        description="A test video description."
        duration="2:34"
        videoUrl="https://example.com/video"
        thumbnailUrl="https://example.com/thumb.jpg"
        topics={['React', 'Testing']}
      />
    );
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('A test video description.')).toBeInTheDocument();
    // Thumbnail is rendered as an img with alt text
    expect(screen.getByAltText('Test Video')).toBeInTheDocument();
  });

  it('renders fallback thumbnail if no thumbnailUrl', () => {
    render(
      <VideoCard
        title="No Thumb"
        description="No thumbnail provided."
        duration="1:00"
        videoUrl="https://example.com/video2"
      />
    );
    expect(screen.getByText('No Thumb')).toBeInTheDocument();
    expect(screen.getByText('No thumbnail provided.')).toBeInTheDocument();
  });
});
