import { NavLink } from "react-router-dom";
import Marquee from "./Marquee";
import { useContext } from "react";
import { SdkContext } from "../hooks/providers/SdkProvider";

const Navbar = () => {
  const { sdk } = useContext(SdkContext);
  return (
    <>
      <Marquee />
      <nav className="w-full h-16 bg-zinc-800">
        <div className="container mx-auto px-4 h-full">
          <div className="flex justify-between items-center h-full">
            <NavLink
              className="flex items-center gap-2 text-white font-black text-xl md:text-2xl"
              to="/"
            >
              <img src={"/logo.png"} className="h-6" />
              <p>
                <span className="bg-gradient-to-tr from-purple-500 to-pink-500 text-transparent bg-clip-text">
                  n
                </span>
                pub
                <span className="text-sm">.cash</span>
              </p>
            </NavLink>
            <ul className="flex gap-x-4 text-white items-center">
              <li>
                <NavLink
                  className={({ isActive }) => {
                    if (isActive) {
                      return "text-transparent bg-gradient-to-tr from-purple-500 to-pink-500 bg-clip-text";
                    }
                  }}
                  to="/"
                >
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink
                  className={({ isActive }) => {
                    if (isActive) {
                      return "text-transparent bg-gradient-to-tr from-purple-500 to-pink-500 bg-clip-text";
                    }
                  }}
                  to={{ pathname: sdk ? "/wallet" : "setup" }}
                >
                  Wallet
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
