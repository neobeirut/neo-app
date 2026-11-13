// Shared by the server fallback and the interactive homepage; no browser APIs.
const title = "NÉO Beirut | Bakery, Bistro & Corporate Lunch Boxes";
const description = "Discover NÉO Beirut's French-inspired bistro, artisan bakery, pastries and corporate catering. Explore business lunch boxes, breakfast trays and coffee breaks in Beirut.";
export function HomepageHead() {
  return <>
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href="https://www.neobeirut.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="NÉO Beirut" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content="https://www.neobeirut.com/" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "Restaurant",
      "@id": "https://www.neobeirut.com/#restaurant",
      name: "NÉO Beirut", url: "https://www.neobeirut.com/", description,
      servesCuisine: "French-inspired",
      hasMenu: "https://www.neobeirut.com/#menu"
    }).replace(/</g, "\\u003c") }} />
  </>;
}
export function HomepageOverview() {
  return <section aria-labelledby="neo-overview" className="py-24 px-4 bg-white text-gray-900">
    <div className="max-w-4xl mx-auto">
      <h2 id="neo-overview" className="text-3xl font-bold mb-4 text-[#2D5F5D]">NÉO Beirut: bakery, bistro and corporate catering</h2>
      <p className="text-lg mb-4">NÉO Beirut brings together French-inspired cuisine, artisan breads, pastries and specialty coffee in Beirut.</p>
      <h3 className="text-2xl font-semibold mb-3">Business lunch boxes and office catering in Beirut</h3>
      <p className="mb-4">Our business lunch boxes include chef-crafted sandwiches, salads, daily specials and balanced gourmet options, individually packed. Corporate catering also includes executive breakfast trays, coffee break packages, and hot or cold event catering.</p>
      <p><a className="underline" href="/corporate-catering-beirut">Explore corporate catering and lunch boxes</a>{" · "}<a className="underline" href="/download-app">Get the NÉO Beirut ordering app</a></p>
    </div>
  </section>;
}
