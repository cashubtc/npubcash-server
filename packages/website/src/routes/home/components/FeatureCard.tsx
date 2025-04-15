import { ReactNode } from "react";

type FeatureCardPorps = {
  icon: ReactNode;
  title: string;
  body: string;
};

function FeatureCard({ icon, title, body }: FeatureCardPorps) {
  return (
    <div className="bg-gradient-to-tr p-0.5 from-purple-500 shadow-lg to-pink-500 rounded">
      <div className="flex flex-col bg-zinc-800 items-center p-4">
        <div className="text-2xl text-purple-400 rounded-full mb-4">{icon}</div>
        <p className="text-lg  font-bold">{title}</p>
        <p className="text-center text-purple-400 text-sm">{body}</p>
      </div>
    </div>
  );
}

export default FeatureCard;
