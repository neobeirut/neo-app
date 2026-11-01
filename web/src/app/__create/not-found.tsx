import { data } from 'react-router';

export const loader = () => data(null, { status: 404 });
export const headers = () => ({ 'X-Robots-Tag': 'noindex, nofollow' });
export const meta = () => [
  { title: 'Page not found | NÉO Beirut' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export default function NotFoundPage() {
  return <main className="min-h-screen bg-white text-gray-900 px-6 py-24 text-center">
    <p className="text-[#2D5F5D] font-semibold">NÉO Beirut · 404</p>
    <h1 className="text-4xl font-bold my-6">Page not found</h1>
    <p className="mb-8">The page you requested could not be found.</p>
    <a className="underline mr-6" href="/">Back to NÉO Beirut</a>
    <a className="underline" href="/contact">Contact us</a>
  </main>;
}
