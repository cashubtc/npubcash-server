import { NavLink } from "react-router-dom";

function Hero() {
  return (
    <section className="flex flex-col justify-center items-center mt-24 gap-8 opacity-0 animate-fadein">
      <div className="flex flex-col gap-2">
        <h2 className="text-center font-bold text-4xl md:text-6xl bg-gradient-to-tr from-purple-500 to-pink-500 bg-clip-text text-transparent">
          npub.cash
        </h2>
        <p className="text-center">
          A nostr native Lightning Address for everyone
        </p>
      </div>
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-tr to-pink-500 from-purple-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
        <div className="relative bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5 rounded">
          <div className="bg-zinc-900 p-4">
            <p className="bg-gradient-to-tr from-purple-500 to-pink-500 text-transparent bg-clip-text tmd:text-2xl text-center font-bold ">{`<npub|user>@npub.cash`}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-4">
        <NavLink
          to={{ pathname: "/wallet" }}
          className="px-2 py-1 bg-gradient-to-tr from-purple-500 to-pink-500 rounded hover:from-purple-700 hover:to-pink-700 transition"
        >
          Try it!
        </NavLink>
        <NavLink
          to={{ pathname: "/username" }}
          className="px-2 py-1 bg-gradient-to-tr from-purple-600 to-pink-600 rounded hover:from-purple-700 hover:to-pink-700 transition"
        >
          Claim Username
        </NavLink>
      </div>
    </section>
  );
}

export default Hero;
