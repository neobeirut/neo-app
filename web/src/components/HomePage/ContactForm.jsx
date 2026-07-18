export function ContactForm() {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg">
      <h3 className="text-2xl font-bold text-[#235b4e] mb-6">
        Send us a Message
      </h3>
      <form className="space-y-4">
        <input
          type="text"
          placeholder="Your Name"
          className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
        />
        <input
          type="email"
          placeholder="Email Address"
          className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
        />
        <input
          type="tel"
          placeholder="Phone Number"
          className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
        />
        <textarea
          placeholder="Your Message"
          rows={6}
          className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
        ></textarea>
        <button
          type="submit"
          className="w-full bg-[#235b4e] text-white px-6 py-3 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium"
        >
          Send Message
        </button>
      </form>
    </div>
  );
}
