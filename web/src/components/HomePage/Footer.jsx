export function Footer({ scrollToSection }) {
  return (
    <footer className="border-t border-gray-200 py-12 px-4 bg-[#2D5F5D] text-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-4">
              <img
                src="https://ucarecdn.com/07124162-e932-4dab-85f2-704f1fd1aad2/-/format/auto/"
                alt="Neo Beirut"
                className="h-12 w-12 mr-3 bg-white rounded-lg p-1"
              />
              <div className="text-3xl font-bold">NEO BEIRUT</div>
            </div>
            <p className="text-gray-100">Flavors Worth Savoring</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-xl">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => scrollToSection("about")}
                  className="text-gray-100 hover:text-white transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("menu")}
                  className="text-gray-100 hover:text-white transition-colors"
                >
                  Menu
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("contact")}
                  className="text-gray-100 hover:text-white transition-colors"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <a
                  href="/shop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-100 hover:text-white transition-colors"
                >
                  Order Online
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-xl">Follow Us</h4>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/Neobeirut"
                className="w-10 h-10 bg-white text-[#2D5F5D] rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all font-bold"
              >
                F
              </a>
              <a
                href="https://www.instagram.com/neobeirut"
                className="w-10 h-10 bg-white text-[#2D5F5D] rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all font-bold"
              >
                I
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8 text-center text-gray-100">
          <p>© {new Date().getFullYear()} Neo Beirut. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
