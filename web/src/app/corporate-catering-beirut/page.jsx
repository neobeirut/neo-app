import { publicPageMeta } from '@/utils/seo';
export const meta = () => publicPageMeta({
  title: 'Corporate Catering & Business Lunch Boxes in Beirut | NÉO',
  description: 'Explore NÉO Beirut corporate catering: individually packed business lunch boxes, executive breakfast trays, coffee breaks, and hot or cold event catering.',
  path: '/corporate-catering-beirut',
});

export default function CorporateCateringPage() {
  return <div className="min-h-screen bg-white text-gray-900">
    <nav aria-label="Main navigation" className="border-b px-6 py-6 flex flex-wrap gap-6">
      <a href="/" className="font-bold text-[#2D5F5D]">NÉO Beirut</a>
      <a href="/#menu">Menu</a><a href="/contact">Contact</a><a href="/download-app">Ordering app</a>
    </nav>
    <main className="max-w-4xl mx-auto px-6 py-16">
      <p className="text-[#2D5F5D] font-semibold mb-4">NÉO Beirut · Corporate catering</p>
      <h1 className="text-4xl md:text-5xl font-bold mb-6">Corporate catering and business lunch boxes in Beirut</h1>
      <p className="text-xl mb-12">From breakfast meetings to office lunches and events, explore NÉO Beirut's catering options and contact our team to discuss your requirements.</p>
      <section className="mb-10"><h2 className="text-2xl font-bold mb-3">Individually packed business lunch boxes</h2>
        <p>Chef-crafted sandwiches, salads, daily specials and balanced gourmet options, individually packed and presented for business lunches.</p></section>
      <section className="mb-10"><h2 className="text-2xl font-bold mb-3">Executive breakfast trays</h2>
        <p>Freshly baked croissants, mini viennoiseries, artisan breads, seasonal fruit and premium coffee for morning meetings.</p></section>
      <section className="mb-10"><h2 className="text-2xl font-bold mb-3">Coffee break packages</h2>
        <p>Sweet and savory assortments paired with specialty coffee and beverages.</p></section>
      <section className="mb-10"><h2 className="text-2xl font-bold mb-3">Hot and cold event catering</h2>
        <p>Explore cold platters and canapés or chef-prepared hot dishes tailored to your event.</p></section>
      <section className="bg-gray-50 rounded-xl p-8"><h2 className="text-2xl font-bold mb-3">Discuss your catering request</h2>
        <p className="mb-6">Tell our team your event date, number of guests and preferred options to discuss availability and a suitable selection.</p>
        <a className="inline-block rounded-lg bg-[#2D5F5D] px-6 py-3 text-white" href="/contact">Contact NÉO Beirut</a>
      </section>
    </main>
    <footer className="border-t px-6 py-8 text-center"><a className="underline" href="/">Back to NÉO Beirut</a></footer>
  </div>;
}
