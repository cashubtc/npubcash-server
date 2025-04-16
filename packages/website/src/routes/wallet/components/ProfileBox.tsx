import { useEffect, useState } from "react";
import { pool } from "../../../main";
import { nip19 } from "nostr-tools";

type ProfileBoxProps = {
  publicKey: string;
};

function ProfileBox({ publicKey }: ProfileBoxProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<{ name?: string; picture?: string }>();
  useEffect(() => {
    pool
      .get(["wss://njump.me", "wss://nos.lol"], {
        kinds: [0],
        authors: [publicKey],
      })
      .then((data) => {
        setIsLoading(false);
        if (data) {
          const profileData = JSON.parse(data?.content);
          setProfile(profileData);
        }
      });
  }, [publicKey]);
  if (!isLoading && !profile) {
    return (
      <div className="flex flex-col items-center">
        <p>Could not get profile data</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col items-center">
        <p>Loading...</p>
      </div>
    );
  }
  if (!isLoading && profile) {
    return (
      <div className="flex flex-col items-center gap-2">
        {profile.picture ? (
          <img src={profile.picture} className="w-12 h-12 rounded-full" />
        ) : undefined}
        <p>{profile.name || nip19.npubEncode(publicKey).slice(0, 10)}</p>
      </div>
    );
  }
}

export default ProfileBox;
