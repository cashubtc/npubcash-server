import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

function ModalContent() {
  return (
    <>
      <div className="inset-0 bg-black opacity-80 absolute" />
      <div className="absolute inset-0 flex justify-center items-center">
        <dialog
          open
          className="flex flex-col justify-center items-center p-4 rounded bg-zinc-800 text-white"
        >
          <p className="text-center p-16">
            Looks like you do not have a{" "}
            <a className="bg-gradient-to-tr from-purple-500 to-pink-500 text-transparent bg-clip-text">
              NIP-07
            </a>{" "}
            provider installed. Get one at{" "}
            <a
              className="bg-gradient-to-tr from-purple-500 to-pink-500 text-transparent bg-clip-text"
              href="https://getalby.com"
            >
              getalby.com
            </a>
          </p>
          <Link
            className="px-4 py-2 bg-gradient-to-tr from-purple-500 to-pink-500 rounded"
            to="/"
          >
            Back Home
          </Link>
        </dialog>
      </div>
    </>
  );
}

function AlbyModal({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) {
    return null;
  }
  return createPortal(<ModalContent />, document.getElementById("modal")!);
}

export default AlbyModal;
