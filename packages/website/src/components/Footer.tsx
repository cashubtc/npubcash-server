import { FaGithub, FaTwitter } from "react-icons/fa6";
import { GiOstrich } from "react-icons/gi";

function Footer() {
  return (
    <div className="w-full items-center border-zinc-800 border-t-2 text-zinc-600">
      <div className="flex w-full justify-around px-8 py-4">
        <a href="https://github.com/lightning-digital-entertainment/cashu-address">
          <FaGithub className="hover:text-purple-600" />
        </a>
        <a href="https://twitter.com/lde_lightning">
          <FaTwitter className="hover:text-purple-600" />
        </a>
        <a href="https://primal.net/p/npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226">
          <GiOstrich className="hover:text-purple-600" />
        </a>
      </div>
    </div>
  );
}

export default Footer;
