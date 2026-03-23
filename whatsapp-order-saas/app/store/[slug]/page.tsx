import { redirect } from 'next/navigation';

// Superseded by /order/[vendor]  next.config.mjs permanent redirect handles it at the CDN level.
export default function StorePage({ params }: { params: { slug: string } }) {
  redirect('/order/' + params.slug);
}

